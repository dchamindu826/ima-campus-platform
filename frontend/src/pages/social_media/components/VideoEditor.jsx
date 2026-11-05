import React, { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, 
  Video, 
  Wand2, 
  Download, 
  Copy, 
  Check, 
  Type, 
  Sparkles, 
  HelpCircle, 
  Layers, 
  FileText,
  ChevronDown,
  Info
} from 'lucide-react';
import api from '../../../api/axios';
import { unicodeToLegacy, splitCaptionsWordByWord, splitCaptionsByChunks, splitCaptionsByScriptSync, ensureSequentialCues } from '../../../utils/sinhalaFontConverter';
import { extractFastAudioBlob } from '../../../utils/audioExtractor';

export default function VideoEditor() {
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [captions, setCaptions] = useState([]);
  const [rawWordCues, setRawWordCues] = useState([]);
  const [rawSegments, setRawSegments] = useState([]);
  const [captionMode, setCaptionMode] = useState('sync'); // Default to 🎯 Auto Script & Voice Sync
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedCaption, setSelectedCaption] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCapCutGuide, setShowCapCutGuide] = useState(false);
  
  // Custom scratchpad converter text
  const [converterInput, setConverterInput] = useState('');
  const [converterCopied, setConverterCopied] = useState(false);

  // Global Styles
  const [globalStyles, setGlobalStyles] = useState({
    fontFamily: 'sans-serif',
    isLegacyFont: false,
    fontSize: 44,
    color: '#facc15', // Vibrant Yellow
    strokeColor: '#000000',
    strokeWidth: 2,
    shadowColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2
  });

  const videoRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setCaptions([]);
      setRawWordCues([]);
      setRawSegments([]);
    }
  };

  const handleProcessVideo = async () => {
    if (!videoFile) return;
    setIsProcessing(true);
    setProcessingStage('1/2 Extracting Audio...');
    
    try {
      const formData = new FormData();
      
      // Extract lightweight audio (16kHz mono WAV ~200KB) on client device for lightning-speed upload
      const audioBlob = await extractFastAudioBlob(videoFile);
      if (audioBlob) {
        formData.append('audio', audioBlob, 'audio.wav');
        console.log(`[FastAudio] Extracted lightweight audio blob: ${audioBlob.size} bytes`);
      } else {
        formData.append('video', videoFile);
      }
      
      setProcessingStage('2/2 AI Transcribing & Syncing Script...');
      
      const response = await api.post('/social-media/video-editor/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000 // 60 seconds
      });
      
      const data = response.data;
      const wordCues = data.captions || [];
      const segments = data.rawSegments || [];
      setRawWordCues(wordCues);
      setRawSegments(segments);

      // Auto Script Sync by default
      const initialChunked = splitCaptionsByScriptSync(segments, wordCues, 28, false);
      setCaptions(initialChunked);
      setCaptionMode('sync');

      alert(`Success! Generated ${initialChunked.length} natural script-synced caption blocks matching video voice pauses.`);
    } catch (error) {
      console.error('[VideoEditor Error]:', error);
      const errMsg = error.response?.data?.error || error.message || 'Network error during upload';
      alert('Error: ' + errMsg);
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  // Generic SRT Exporter Helper
  const downloadSRT = (rawItems, filename) => {
    if (!rawItems || rawItems.length === 0) return;

    const items = ensureSequentialCues(rawItems);

    const formatSRTTime = (seconds) => {
      const pad = (num, size) => ('000' + num).slice(size * -1);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)},${pad(ms, 3)}`;
    };

    let srtContent = '';
    items.forEach((c, index) => {
      srtContent += `${index + 1}\n`;
      srtContent += `${formatSRTTime(c.start)} --> ${formatSRTTime(c.end)}\n`;
      srtContent += `${c.text}\n\n`;
    });

    // UTF-8 BOM (\uFEFF)
    const blob = new Blob(['\uFEFF' + srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  // 1. Export CapCut Word-by-Word (FM-Abhaya Encoded)
  const handleExportCapCutWordByWord = () => {
    const source = rawWordCues.length > 0 ? rawWordCues : captions;
    const granular = splitCaptionsWordByWord(source, true);
    downloadSRT(granular, 'capcut_word_by_word_fm_abhaya.srt');
  };

  // 2. Export CapCut Phrase Chunks (FM-Abhaya Encoded)
  const handleExportCapCutChunks = (modeChoice = captionMode) => {
    let chunked = [];
    if (modeChoice === 'sync') {
      chunked = splitCaptionsByScriptSync(rawSegments, rawWordCues, 28, true);
    } else {
      const targetSize = (modeChoice >= 99) ? 3 : modeChoice;
      const source = rawWordCues.length > 0 ? rawWordCues : captions;
      chunked = splitCaptionsByChunks(source, targetSize, true);
    }
    downloadSRT(chunked, `capcut_phrase_${modeChoice}_fm_abhaya.srt`);
  };

  // 3. Export CapCut Standard Sentence (FM-Abhaya Encoded)
  const handleExportCapCutSentences = () => {
    const source = rawSegments.length > 0 ? rawSegments : captions;
    const fmCaptions = source.map(c => ({
      ...c,
      text: unicodeToLegacy(c.text || c.originalText)
    }));
    downloadSRT(fmCaptions, 'capcut_sentences_fm_abhaya.srt');
  };

  // 4. Export Unicode Word-by-Word
  const handleExportUnicodeWordByWord = () => {
    const source = rawWordCues.length > 0 ? rawWordCues : captions;
    const granular = splitCaptionsWordByWord(source, false);
    downloadSRT(granular, 'captions_word_by_word_unicode.srt');
  };

  // 5. Export Standard Unicode SRT
  const handleExportUnicodeStandard = () => {
    const source = rawSegments.length > 0 ? rawSegments : captions;
    downloadSRT(source, 'captions_standard_unicode.srt');
  };

  // Export Hardcoded Video Render with FFmpeg
  const handleExportVideo = async () => {
    if (!videoFile || captions.length === 0) return;
    setIsProcessing(true);

    try {
      const exportCaptions = captions.map(c => ({
        ...c,
        text: globalStyles.isLegacyFont ? unicodeToLegacy(c.text) : c.text
      }));

      const formData = new FormData();
      formData.append('video', videoFile);
      formData.append('captions', JSON.stringify(exportCaptions));
      formData.append('styles', JSON.stringify(globalStyles));

      const response = await api.post('/social-media/video-editor/export', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const data = response.data;
      if (data.downloadUrl) {
         const a = document.createElement('a');
         a.href = data.downloadUrl.startsWith('http') ? data.downloadUrl : api.defaults.baseURL.replace('/api', '') + data.downloadUrl;
         a.download = 'IMA_Promo_Burned_Subtitles.mp4';
         document.body.appendChild(a);
         a.click();
         document.body.removeChild(a);
         alert('Export successful! Downloading video...');
      } else {
         alert('Export started! Check backend processing.');
      }
    } catch (error) {
      console.error(error);
      alert('Export Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyFM = (text, id) => {
    const fm = unicodeToLegacy(text);
    navigator.clipboard.writeText(fm);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const playCaption = (cap) => {
    if (videoRef.current && cap) {
      videoRef.current.currentTime = Math.max(0, cap.start);
      videoRef.current.play();
    }
  };

  const nudgeTime = (id, field, delta) => {
    setCaptions(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newVal = Math.max(0, parseFloat((c[field] + delta).toFixed(2)));
      return { ...c, [field]: newVal };
    }));
    if (selectedCaption?.id === id) {
      setSelectedCaption(prev => ({ ...prev, [field]: Math.max(0, parseFloat((prev[field] + delta).toFixed(2))) }));
    }
  };

  const deleteCaption = (id) => {
    setCaptions(prev => prev.filter(c => c.id !== id));
    if (selectedCaption?.id === id) setSelectedCaption(null);
  };

  const addCaptionBelow = (currentCap) => {
    const newStart = currentCap ? currentCap.end : (currentTime || 0);
    const newEnd = newStart + 2.0;
    const newCap = {
      id: Date.now(),
      start: parseFloat(newStart.toFixed(2)),
      end: parseFloat(newEnd.toFixed(2)),
      text: 'අලුත් caption එක'
    };
    setCaptions(prev => [...prev, newCap].sort((a, b) => a.start - b.start));
    setSelectedCaption(newCap);
  };

  // Merge selected cue with the next cue to match custom script phrases
  const mergeWithNextCue = (currentCap) => {
    if (!currentCap) return;
    const currentIndex = captions.findIndex(c => c.id === currentCap.id);
    if (currentIndex === -1 || currentIndex >= captions.length - 1) return;

    const nextCap = captions[currentIndex + 1];
    const mergedCap = {
      ...currentCap,
      end: nextCap.end,
      text: `${currentCap.text} ${nextCap.text}`.trim(),
      originalText: `${currentCap.originalText || currentCap.text} ${nextCap.originalText || nextCap.text}`.trim()
    };

    setCaptions(prev => {
      const copy = [...prev];
      copy.splice(currentIndex, 2, mergedCap);
      return copy;
    });
    setSelectedCaption(mergedCap);
  };

  // Split selected cue into two sub-phrases
  const splitCurrentCue = (currentCap) => {
    if (!currentCap || !currentCap.text) return;
    const words = currentCap.text.trim().split(/\s+/);
    if (words.length <= 1) return;

    const mid = Math.ceil(words.length / 2);
    const firstHalf = words.slice(0, mid).join(' ');
    const secondHalf = words.slice(mid).join(' ');
    const midTime = parseFloat(((currentCap.start + currentCap.end) / 2).toFixed(2));

    const cap1 = { ...currentCap, end: midTime, text: firstHalf, originalText: firstHalf };
    const cap2 = { id: Date.now(), start: midTime, end: currentCap.end, text: secondHalf, originalText: secondHalf };

    setCaptions(prev => {
      const currentIndex = prev.findIndex(c => c.id === currentCap.id);
      const copy = [...prev];
      copy.splice(currentIndex, 1, cap1, cap2);
      return copy;
    });
    setSelectedCaption(cap1);
  };

  const rechunkCaptions = (modeChoice = 'sync') => {
    setCaptionMode(modeChoice);
    const sourceCues = rawWordCues.length > 0 ? rawWordCues : captions;
    if (sourceCues.length === 0) return;

    let rechunked = [];
    if (modeChoice === 'sync') {
      rechunked = splitCaptionsByScriptSync(rawSegments, rawWordCues, 28, false);
    } else if (modeChoice >= 99 && rawSegments.length > 0) {
      rechunked = rawSegments.map((s, idx) => ({
        id: idx + 1,
        start: s.start,
        end: s.end,
        text: s.text,
        originalText: s.text
      }));
    } else {
      rechunked = splitCaptionsByChunks(sourceCues, modeChoice, false);
    }

    setCaptions(rechunked);
    if (selectedCaption) {
      const match = rechunked.find(r => r.id === selectedCaption.id) || rechunked[0];
      setSelectedCaption(match || null);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  };

  const updateCaption = (id, field, value) => {
    setCaptions(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };
  
  const updateGlobalStyle = (field, value) => {
      setGlobalStyles(prev => ({ ...prev, [field]: value }));
  };

  const activeCaption = captions.find(c => currentTime >= c.start && currentTime <= c.end);
  const displayCaptionText = activeCaption ? (globalStyles.isLegacyFont ? unicodeToLegacy(activeCaption.text) : activeCaption.text) : "";

  return (
    <div className="bg-[#111827] p-6 rounded-2xl border border-white/10 shadow-2xl flex flex-col h-[88vh] text-white">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <Video className="text-brand-accent" /> AI Subtitle Studio & CapCut Exporter
          </h2>
          <p className="text-xs text-slate-400">Generate AI timestamps, convert Sinhala Unicode to FM-Abhaya, and export word-by-word SRTs for CapCut.</p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/uploads/social-media/fonts/Sinhala_FM_Fonts_Pack.zip"
            download="Sinhala_FM_Fonts_Pack.zip"
            className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Download FM-Abhaya, FM-Bindumathi & 15+ Sinhala fonts pack for CapCut"
          >
            <Download size={14} className="text-amber-400" /> Download FM Fonts (.zip)
          </a>

          <button 
            onClick={() => setShowCapCutGuide(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors"
          >
            <HelpCircle size={14} className="text-amber-400" /> CapCut Import Guide
          </button>

          {videoFile && captions.length > 0 && (
            <div className="relative">
              <button 
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Download size={16} /> Export for CapCut / SRT <ChevronDown size={14} />
              </button>

              {/* Export Dropdown Menu */}
              {showExportMenu && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-50 p-2 flex flex-col gap-1 backdrop-blur-xl">
                  <div className="p-2 border-b border-white/5">
                    <p className="text-[10px] uppercase font-extrabold tracking-wider text-amber-400">⚡ CapCut Optimized (FM-Abhaya / No Boxes)</p>
                  </div>
                  
                  <button 
                    onClick={handleExportCapCutWordByWord}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-600/20 hover:text-indigo-300 text-xs font-bold flex items-center justify-between transition-colors"
                  >
                    <span>Word-by-Word SRT <span className="text-[10px] text-emerald-400 block font-normal">(Animate & style each word separately in CapCut)</span></span>
                    <Sparkles size={14} className="text-amber-400 flex-shrink-0" />
                  </button>

                  <button 
                    onClick={handleExportCapCutChunks}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-600/20 hover:text-indigo-300 text-xs font-bold flex items-center justify-between transition-colors"
                  >
                    <span>Phrase Chunks SRT (2-3 words) <span className="text-[10px] text-slate-400 block font-normal">(Modern viral Reel/Shorts pace)</span></span>
                    <Layers size={14} className="text-indigo-400 flex-shrink-0" />
                  </button>

                  <button 
                    onClick={handleExportCapCutSentences}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-indigo-600/20 hover:text-indigo-300 text-xs font-bold flex items-center justify-between transition-colors"
                  >
                    <span>Standard Sentence SRT (FM) <span className="text-[10px] text-slate-400 block font-normal">(Full sentence blocks)</span></span>
                    <FileText size={14} className="text-slate-400 flex-shrink-0" />
                  </button>

                  <div className="p-2 border-b border-t border-white/5 mt-1">
                    <p className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">🌐 Standard Unicode (Premiere / DaVinci)</p>
                  </div>

                  <button 
                    onClick={handleExportUnicodeWordByWord}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs font-medium text-slate-300 transition-colors"
                  >
                    Unicode Word-by-Word SRT
                  </button>

                  <button 
                    onClick={handleExportUnicodeStandard}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 text-xs font-medium text-slate-300 transition-colors"
                  >
                    Unicode Standard Sentence SRT
                  </button>
                </div>
              )}
            </div>
          )}

          {videoFile && captions.length > 0 && (
            <button 
              onClick={handleExportVideo}
              disabled={isProcessing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Wand2 size={16} /> {isProcessing ? 'Exporting...' : 'Burn & Render MP4'}
            </button>
          )}

          {/* Caption Grouping Option Selector */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl shadow-inner">
            <span className="text-[10px] text-slate-400 font-extrabold px-2 uppercase tracking-wider">Style:</span>
            <button
              onClick={() => rechunkCaptions('sync')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                captionMode === 'sync' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/40 font-black scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Syncs naturally with video audio pauses & script clauses"
            >
              🎯 Script & Voice Sync
            </button>
            <button
              onClick={() => rechunkCaptions(1)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                captionMode === 1 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 font-black scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="1 word at a time (TikTok pop style)"
            >
              ⚡ 1-Word
            </button>
            <button
              onClick={() => rechunkCaptions(2)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                captionMode === 2 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 font-black scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="2 words phrase (Clean 2-word layout)"
            >
              💬 2-Words
            </button>
            <button
              onClick={() => rechunkCaptions(3)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                captionMode === 3 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 font-black scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="3 words phrase (Viral Reels/Shorts pace)"
            >
              🔥 3-Words
            </button>
            <button
              onClick={() => rechunkCaptions(999)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                captionMode >= 99 ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/40 font-black scale-105' : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
              title="Full sentence blocks"
            >
              📜 Sentences
            </button>
          </div>

          {videoFile && (
            <button 
              onClick={handleProcessVideo}
              disabled={isProcessing}
              className="bg-brand-accent hover:bg-brand-accent/90 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-brand-accent/30"
            >
              <Sparkles size={16} /> {isProcessing ? (processingStage || 'Processing AI...') : 'Auto Generate Sinhala Captions'}
            </button>
          )}
        </div>
      </div>

      {!videoUrl ? (
        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-2xl bg-black/30 relative hover:border-brand-accent/50 transition-colors">
          <input 
            type="file" 
            accept="video/*" 
            onChange={handleFileUpload}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <UploadCloud size={56} className="text-brand-accent mb-4 animate-bounce" />
          <h3 className="text-lg font-black text-white mb-1">Drag & Drop Promo Video</h3>
          <p className="text-xs text-slate-400">Supported formats: MP4, MOV, MKV (Auto-extracts voice for word timestamps)</p>
        </div>
      ) : (
        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Main Video & Timeline Area */}
          <div className="flex flex-col flex-1 gap-4 overflow-hidden">
            <div className="flex-1 bg-black rounded-2xl overflow-hidden relative flex justify-center items-center border border-white/10 shadow-inner">
              <video 
                ref={videoRef}
                src={videoUrl} 
                controls 
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                className="max-w-full max-h-full"
              />
              
              {/* Real-time Subtitle Preview */}
              {activeCaption && (
                 <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none px-10">
                    <span 
                      className="font-black drop-shadow-2xl px-4 py-2 inline-block tracking-wide" 
                      style={{ 
                        fontFamily: globalStyles.fontFamily,
                        fontSize: `${globalStyles.fontSize}px`,
                        color: globalStyles.color,
                        WebkitTextStroke: `${globalStyles.strokeWidth}px ${globalStyles.strokeColor}`,
                        textShadow: `${globalStyles.shadowOffsetX}px ${globalStyles.shadowOffsetY}px 0 ${globalStyles.shadowColor}`
                      }}
                    >
                        {displayCaptionText}
                    </span>
                 </div>
              )}
            </div>
            
            {/* Timeline UI */}
            <div className="h-44 bg-[#0f172a] border border-white/10 rounded-2xl p-4 flex flex-col shadow-xl">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-slate-300 font-black text-xs uppercase tracking-wider">Word Timeline</p>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
                    {captions.length} {captionMode === 1 ? 'Words' : captionMode === 2 ? '2-Word Phrases' : captionMode === 3 ? '3-Word Phrases' : 'Sentences'}
                  </span>

                  {captions.length > 0 && (
                    <div className="flex items-center gap-1 ml-3 bg-black/40 p-0.5 rounded-lg border border-white/5">
                      <button
                        onClick={() => rechunkCaptions('sync')}
                        className={`text-[10px] px-2 py-0.5 rounded transition-all font-bold ${
                          captionMode === 'sync' ? 'bg-emerald-600 text-white font-black shadow' : 'bg-white/5 hover:bg-white/15 text-slate-300'
                        }`}
                        title="Sync naturally with voice pauses & script clauses"
                      >
                        🎯 Script & Voice Sync
                      </button>
                      <button
                        onClick={() => rechunkCaptions(1)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-all font-bold ${
                          captionMode === 1 ? 'bg-indigo-600 text-white font-black shadow' : 'bg-white/5 hover:bg-white/15 text-slate-300'
                        }`}
                        title="Split into single 1-word pop cues"
                      >
                        ⚡ 1-Word
                      </button>
                      <button
                        onClick={() => rechunkCaptions(2)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-all font-bold ${
                          captionMode === 2 ? 'bg-indigo-600 text-white font-black shadow' : 'bg-white/5 hover:bg-white/15 text-slate-300'
                        }`}
                        title="Split into 2-word phrases"
                      >
                        💬 2-Words
                      </button>
                      <button
                        onClick={() => rechunkCaptions(3)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-all font-bold ${
                          captionMode === 3 ? 'bg-indigo-600 text-white font-black shadow' : 'bg-white/5 hover:bg-white/15 text-slate-300'
                        }`}
                        title="Split into 3-word cards"
                      >
                        🔥 3-Words
                      </button>
                      <button
                        onClick={() => rechunkCaptions(999)}
                        className={`text-[10px] px-2 py-0.5 rounded transition-all font-bold ${
                          captionMode >= 99 ? 'bg-indigo-600 text-white font-black shadow' : 'bg-white/5 hover:bg-white/15 text-slate-300'
                        }`}
                        title="Full sentences"
                      >
                        📜 Sentences
                      </button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-brand-accent font-mono font-bold">{currentTime.toFixed(2)}s / {videoDuration.toFixed(2)}s</p>
              </div>
              
              <div className="flex-1 bg-black/60 rounded-xl relative overflow-x-auto overflow-y-hidden border border-white/10 p-2">
                 {videoDuration > 0 && captions.map(c => {
                     const left = (c.start / videoDuration) * 100;
                     const width = ((c.end - c.start) / videoDuration) * 100;
                     const isSelected = selectedCaption?.id === c.id;
                     const isActive = currentTime >= c.start && currentTime <= c.end;
                     
                     return (
                         <div 
                           key={c.id}
                           onClick={() => setSelectedCaption(c)}
                           className={`absolute h-8 top-1/2 -translate-y-1/2 rounded-lg cursor-pointer border truncate px-2 text-xs font-black leading-8 transition-all shadow-md ${
                               isSelected 
                                ? 'bg-brand-accent border-white text-white z-20 scale-105 shadow-brand-accent/50' 
                                : isActive 
                                ? 'bg-amber-500 border-amber-300 text-black z-10' 
                                : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
                           }`}
                           style={{ left: `${left}%`, width: `${Math.max(width, 1.2)}%`, minWidth: '40px' }}
                           title={`${c.text} (${c.start.toFixed(1)}s - ${c.end.toFixed(1)}s)`}
                         >
                            {c.text}
                         </div>
                     );
                 })}
                 
                 {/* Playhead */}
                 {videoDuration > 0 && (
                     <div 
                       className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-30"
                       style={{ left: `${(currentTime / videoDuration) * 100}%` }}
                     >
                         <div className="absolute -top-1.5 -left-1.5 w-3.5 h-3.5 bg-red-500 rounded-full shadow-lg"></div>
                     </div>
                 )}
              </div>
            </div>
          </div>

          {/* Side Panel for Editing & CapCut Tools */}
          <div className="w-96 bg-[#0f172a] rounded-2xl border border-white/10 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4 shadow-2xl">
              
              {/* Scratchpad Converter */}
              <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-amber-400 flex items-center gap-1.5">
                    <Type size={14} /> Quick CapCut Font Converter
                  </span>
                  {converterInput && (
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(unicodeToLegacy(converterInput));
                        setConverterCopied(true);
                        setTimeout(() => setConverterCopied(false), 1500);
                      }}
                      className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                    >
                      {converterCopied ? <Check size={10} /> : <Copy size={10} />} {converterCopied ? 'Copied!' : 'Copy FM'}
                    </button>
                  )}
                </div>
                <input 
                  type="text"
                  placeholder="Type Sinhala text here to convert..."
                  value={converterInput}
                  onChange={(e) => setConverterInput(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400 mb-1.5"
                />
                {converterInput && (
                  <div className="bg-black/60 p-2 rounded border border-amber-500/20 text-[11px] font-mono text-amber-300 break-all">
                    {unicodeToLegacy(converterInput)}
                  </div>
                )}
              </div>

              {/* Selected Caption Block Inspector */}
              {selectedCaption ? (
                  <div className="bg-slate-900/90 border border-indigo-500/30 rounded-xl p-3 flex flex-col gap-2.5">
                      <div className="flex justify-between items-center">
                          <span className="text-xs font-black text-indigo-400">Selected Block #{selectedCaption.id}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => playCaption(selectedCaption)}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1 transition-colors"
                              title="Play this segment"
                            >
                              ▶ Play
                            </button>
                            <button
                              onClick={() => deleteCaption(selectedCaption.id)}
                              className="text-[10px] bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white font-bold px-1.5 py-0.5 rounded transition-colors"
                              title="Delete this cue"
                            >
                              ✕
                            </button>
                          </div>
                      </div>
                      
                      <div>
                        <label className="text-[11px] text-slate-400 font-bold block mb-1">Sinhala Unicode Text</label>
                        <input 
                            type="text"
                            value={selectedCaption.text}
                            onChange={(e) => updateCaption(selectedCaption.id, 'text', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-white text-xs outline-none focus:border-indigo-400"
                        />
                      </div>

                      {/* Script Phrase Adjuster & Grouping Buttons */}
                      <div className="grid grid-cols-3 gap-1.5">
                        <button 
                          onClick={() => mergeWithNextCue(selectedCaption)}
                          className="bg-indigo-900/40 hover:bg-indigo-600/60 text-indigo-200 border border-indigo-500/30 text-[10px] font-bold py-1.5 px-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                          title="Merge this cue with the next cue to group natural script phrases"
                        >
                          🔗 Merge Next
                        </button>
                        <button 
                          onClick={() => splitCurrentCue(selectedCaption)}
                          className="bg-amber-900/40 hover:bg-amber-600/60 text-amber-200 border border-amber-500/30 text-[10px] font-bold py-1.5 px-1.5 rounded-lg transition-colors flex items-center justify-center gap-1"
                          title="Split this cue into two shorter phrases"
                        >
                          ✂️ Split
                        </button>
                        <button 
                          onClick={() => ungroupCue(selectedCaption)}
                          disabled={!selectedCaption?.text || selectedCaption.text.trim().split(/\s+/).length <= 1}
                          className="bg-emerald-900/40 hover:bg-emerald-600/60 text-emerald-200 border border-emerald-500/30 text-[10px] font-bold py-1.5 px-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 disabled:opacity-40 cursor-pointer"
                          title="Ungroup this multi-word cue into individual single-word cues"
                        >
                          🔓 Ungroup
                        </button>
                      </div>

                      {/* FM-Abhaya Code Box with 1-Click Copy */}
                      <div className="bg-black/40 border border-white/5 rounded-lg p-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-amber-400 font-bold">CapCut FM-Abhaya Code</span>
                          <button 
                            onClick={() => handleCopyFM(selectedCaption.text, selectedCaption.id)}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded font-bold flex items-center gap-1 transition-colors"
                          >
                            {copiedId === selectedCaption.id ? <Check size={10} className="text-emerald-300" /> : <Copy size={10} />}
                            {copiedId === selectedCaption.id ? 'Copied FM!' : 'Copy for CapCut'}
                          </button>
                        </div>
                        <p className="text-xs font-mono text-slate-300 break-all select-all bg-black/60 p-1.5 rounded">
                          {unicodeToLegacy(selectedCaption.text)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                          <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-slate-400">Start Time (s)</label>
                                <div className="flex gap-1">
                                  <button onClick={() => nudgeTime(selectedCaption.id, 'start', -0.1)} className="text-[9px] bg-white/5 hover:bg-white/20 px-1 rounded">-0.1</button>
                                  <button onClick={() => nudgeTime(selectedCaption.id, 'start', 0.1)} className="text-[9px] bg-white/5 hover:bg-white/20 px-1 rounded">+0.1</button>
                                </div>
                              </div>
                              <input 
                                  type="number"
                                  step="0.05"
                                  value={selectedCaption.start}
                                  onChange={(e) => updateCaption(selectedCaption.id, 'start', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-white text-xs outline-none focus:border-indigo-400 font-mono"
                              />
                          </div>
                          <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-[10px] text-slate-400">End Time (s)</label>
                                <div className="flex gap-1">
                                  <button onClick={() => nudgeTime(selectedCaption.id, 'end', -0.1)} className="text-[9px] bg-white/5 hover:bg-white/20 px-1 rounded">-0.1</button>
                                  <button onClick={() => nudgeTime(selectedCaption.id, 'end', 0.1)} className="text-[9px] bg-white/5 hover:bg-white/20 px-1 rounded">+0.1</button>
                                </div>
                              </div>
                              <input 
                                  type="number"
                                  step="0.05"
                                  value={selectedCaption.end}
                                  onChange={(e) => updateCaption(selectedCaption.id, 'end', parseFloat(e.target.value) || 0)}
                                  className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-white text-xs outline-none focus:border-indigo-400 font-mono"
                              />
                          </div>
                      </div>

                      <button 
                        onClick={() => addCaptionBelow(selectedCaption)}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold py-1.5 rounded-lg border border-white/5 transition-colors mt-1"
                      >
                        + Add Next Cue After This
                      </button>
                  </div>
              ) : (
                <div className="p-3 border border-dashed border-white/10 rounded-xl text-center text-xs text-slate-400">
                  Click on any caption in the timeline to edit text, audition audio, or nudge timestamps.
                </div>
              )}
              
              {/* Caption Word List */}
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">All Captions List ({captions.length})</h4>
                  {captions.length > 0 && (
                    <button 
                      onClick={() => addCaptionBelow(captions[captions.length - 1])}
                      className="text-[10px] text-brand-accent hover:underline font-bold"
                    >
                      + Add New
                    </button>
                  )}
                </div>
                <div className="flex-1 max-h-60 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 pr-1">
                  {captions.map((cap) => (
                    <div 
                      key={cap.id} 
                      onClick={() => setSelectedCaption(cap)}
                      className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between transition-all ${
                        selectedCaption?.id === cap.id 
                          ? 'bg-indigo-900/40 border-indigo-400 text-white' 
                          : 'bg-black/30 border-white/5 text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          playCaption(cap);
                        }}
                        className="mr-2 text-slate-400 hover:text-emerald-400 transition-colors"
                        title="Play"
                      >
                        ▶
                      </button>

                      <div className="truncate flex-1 mr-2">
                        <span className="font-bold">{cap.text}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {cap.start.toFixed(2)}s → {cap.end.toFixed(2)}s
                        </span>
                      </div>

                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyFM(cap.text, cap.id);
                        }}
                        className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-amber-400 transition-colors"
                        title="Copy FM-Abhaya Code for CapCut"
                      >
                        {copiedId === cap.id ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Global Video Preview Styles */}
              <div className="border-t border-white/10 pt-3 flex flex-col gap-2.5">
                  <h4 className="text-xs font-black text-slate-300 uppercase tracking-wider">Burn-In Subtitle Styles</h4>
                  
                  <div>
                      <label className="text-[10px] text-slate-400">Font Engine</label>
                      <select 
                          value={globalStyles.fontFamily}
                          onChange={(e) => {
                              updateGlobalStyle('fontFamily', e.target.value);
                              updateGlobalStyle('isLegacyFont', e.target.value === 'FM-Abhaya');
                          }}
                          className="w-full bg-black/50 border border-white/10 rounded-lg p-1.5 text-white text-xs outline-none focus:border-brand-accent mt-1"
                      >
                          <option value="sans-serif">Sinhala Unicode (Web/Default)</option>
                          <option value="FM-Abhaya">FM-Abhaya (Legacy / CapCut)</option>
                      </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400">Size ({globalStyles.fontSize}px)</label>
                      <input 
                          type="range"
                          min="16" max="72"
                          value={globalStyles.fontSize}
                          onChange={(e) => updateGlobalStyle('fontSize', parseInt(e.target.value))}
                          className="w-full mt-1 accent-brand-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400">Stroke ({globalStyles.strokeWidth}px)</label>
                      <input 
                          type="range"
                          min="0" max="10"
                          value={globalStyles.strokeWidth}
                          onChange={(e) => updateGlobalStyle('strokeWidth', parseInt(e.target.value))}
                          className="w-full mt-1 accent-brand-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                      <div>
                          <label className="text-[10px] text-slate-400">Text Color</label>
                          <input 
                              type="color"
                              value={globalStyles.color}
                              onChange={(e) => updateGlobalStyle('color', e.target.value)}
                              className="w-full h-7 mt-1 rounded bg-black/50 border border-white/10 cursor-pointer"
                          />
                      </div>
                      <div>
                          <label className="text-[10px] text-slate-400">Stroke Color</label>
                          <input 
                              type="color"
                              value={globalStyles.strokeColor}
                              onChange={(e) => updateGlobalStyle('strokeColor', e.target.value)}
                              className="w-full h-7 mt-1 rounded bg-black/50 border border-white/10 cursor-pointer"
                          />
                      </div>
                  </div>
              </div>
          </div>
        </div>
      )}

      {/* CapCut Sinhala Setup Guide Modal */}
      {showCapCutGuide && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1e293b] border border-white/10 rounded-2xl max-w-xl w-full p-6 shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-base font-black text-amber-400 flex items-center gap-2">
                <Sparkles size={18} /> CapCut එකේ සිංහල Captions කොටු නොවී ලස්සනට දාන ක්‍රමය
              </h3>
              <button 
                onClick={() => setShowCapCutGuide(false)}
                className="text-slate-400 hover:text-white text-xs font-bold bg-white/5 px-2 py-1 rounded"
              >
                ✕ Close
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-slate-300 leading-relaxed">
              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <p className="font-bold text-white mb-1">1. Word-by-Word SRT එක Export කරගන්න:</p>
                <p>Top bar එකේ <b>Export for CapCut / SRT</b> click කර <b>Word-by-Word SRT (FM-Abhaya)</b> තෝරාගන්න.</p>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <p className="font-bold text-white mb-1">2. CapCut එකට Import කරන්න:</p>
                <p>CapCut (PC හෝ Mobile) open කර <b>Text → Auto Captions / Local Subtitles</b> මඟින් download කරගත් SRT එක import කරන්න.</p>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <p className="font-bold text-amber-300 mb-1">3. FM-Abhaya Font එක තෝරන්න (කොටු නැතිවීමට):</p>
                <p>CapCut හි Subtitle එක click කර Font එක ලෙස <b>FM-Abhaya</b> හෝ ඕනෑම <b>FM / DL Sinhala Font</b> එකක් තෝරන්න. එවිට සියලුම සිංහල අකුරු 100% නිවැරදිව පෙනේ.</p>
              </div>

              <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                <p className="font-bold text-emerald-300 mb-1">4. එක් එක් වචනයට වෙන වෙනම Colors/Effects දැමීම:</p>
                <p>CapCut හි Text inspector හි ඇති <b>"Apply to all"</b> tick එක <b>OFF</b> කරන්න. දැන් Timeline එකේ කැමති වචනයක් click කර <b>වෙනම Colors (Yellow, Cyan), Glow, Fonts, හෝ Animations</b> ලබා දිය හැක!</p>
              </div>
            </div>

            <button 
              onClick={() => setShowCapCutGuide(false)}
              className="w-full bg-brand-accent hover:bg-brand-accent/90 text-white font-bold py-2.5 rounded-xl text-xs transition-colors"
            >
              තේරුණා, Export කරමු! 🚀
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  Wand2, Video, Film, Sparkles, Play, Pause, Download, RefreshCw, 
  Search, UploadCloud, Music, Mic, Layers, Plus, Trash2, CheckCircle2, 
  AlertCircle, Sliders, Volume2, Eye, Share2, Copy, Check, ChevronRight,
  Smartphone, Monitor, Square, ArrowRight, Loader2, FastForward, Image as ImageIcon
} from 'lucide-react';
import api from '../../../api/axios';

// Helper: Format full media URL (prepending backend base if relative)
const getMediaUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
    return url;
  }
  const backendBase = (api.defaults.baseURL || '').replace('/api', '');
  return `${backendBase}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function AIVideoGenerator({ loggedInUser }) {
  // Navigation & Step State
  const [activeStep, setActiveStep] = useState(1); // 1: Script/Prompt, 2: Style & Voice, 3: Storyboard & Timeline, 4: Render & Export

  // Script & Topic Input
  const [inputMode, setInputMode] = useState('script'); // 'script' | 'prompt'
  const [userScript, setUserScript] = useState('');
  const [promptTopic, setPromptTopic] = useState('');
  const [targetDuration, setTargetDuration] = useState(30); // 15, 30, 45, 60
  const [selectedLanguage, setSelectedLanguage] = useState('si'); // 'si' | 'en' | 'singlish'
  const [selectedPlatform, setSelectedPlatform] = useState('Reels/TikTok/Shorts');

  // Video Settings & Styles
  const [aspectRatio, setAspectRatio] = useState('9:16'); // '9:16' | '16:9' | '1:1'
  const [voiceSettings, setVoiceSettings] = useState({
    language: 'si',
    voice: 'natural',
    speed: 1.0
  });
  const [subtitleStyle, setSubtitleStyle] = useState({
    preset: 'tiktok',
    fontSize: 68,
    color: '#FFFF00',
    strokeColor: '#000000',
    position: 'bottom'
  });
  const [bgmTrack, setBgmTrack] = useState('bgm-inspiring-future');
  const [bgmVolume, setBgmVolume] = useState(0.12);
  const [bgmTracksList, setBgmTracksList] = useState([]);

  // Storyboard & Scenes Data
  const [videoTitle, setVideoTitle] = useState('IMA_Viral_Video');
  const [videoHook, setVideoHook] = useState('');
  const [scenes, setScenes] = useState([]);

  // Stock Footage Modal
  const [isFootageModalOpen, setIsFootageModalOpen] = useState(false);
  const [activeSceneIdxForFootage, setActiveSceneIdxForFootage] = useState(null);
  const [stockSearchQuery, setStockSearchQuery] = useState('');
  const [stockSearchResults, setStockSearchResults] = useState([]);
  const [isSearchingStock, setIsSearchingStock] = useState(false);

  // Audio Playback
  const [playingAudioIdx, setPlayingAudioIdx] = useState(null);
  const audioPlayerRef = useRef(null);

  // Live Video Preview State
  const [previewCurrentSceneIdx, setPreviewCurrentSceneIdx] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const previewTimerRef = useRef(null);

  // Rendering Process State
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgressStage, setRenderProgressStage] = useState('');
  const [renderedVideoData, setRenderedVideoData] = useState(null);
  const [renderError, setRenderError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  // Loading States
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = useState(false);

  // Fetch BGM Tracks on Mount
  useEffect(() => {
    const fetchBgm = async () => {
      try {
        const res = await api.get('/social-media/ai-video/bgm-tracks');
        if (res.data?.tracks) {
          setBgmTracksList(res.data.tracks);
        }
      } catch (err) {
        console.error('Failed to fetch BGM tracks:', err);
      }
    };
    fetchBgm();
  }, []);

  // Sync voice language when user changes selected language
  useEffect(() => {
    setVoiceSettings(prev => ({
      ...prev,
      language: selectedLanguage === 'en' ? 'en' : 'si'
    }));
  }, [selectedLanguage]);

  // 1. Generate Storyboard with Gemini AI
  const handleGenerateStoryboard = async () => {
    if (inputMode === 'script' && !userScript.trim()) {
      alert('Please enter your script first!');
      return;
    }
    if (inputMode === 'prompt' && !promptTopic.trim()) {
      alert('Please enter a topic or prompt for the AI to write!');
      return;
    }

    setIsGeneratingStoryboard(true);
    setRenderError(null);

    try {
      const payload = {
        script: inputMode === 'script' ? userScript : null,
        topic: inputMode === 'prompt' ? promptTopic : null,
        platform: selectedPlatform,
        aspectRatio,
        targetDuration,
        language: selectedLanguage
      };

      const res = await api.post('/social-media/ai-video/generate-storyboard', payload);
      
      if (res.data && res.data.scenes) {
        setVideoTitle(res.data.title || 'IMA_Viral_Promo');
        setVideoHook(res.data.hook || '');
        setScenes(res.data.scenes);
        setActiveStep(3); // Navigate to Storyboard Editor
      } else {
        throw new Error('Invalid storyboard response format.');
      }
    } catch (err) {
      console.error('[AI Video Generator] Storyboard Generation Error:', err);
      alert(err.response?.data?.error || err.message || 'Failed to generate AI Storyboard.');
    } finally {
      setIsGeneratingStoryboard(false);
    }
  };

  // 2. Play Scene TTS Audio Preview
  const handlePlaySceneAudio = async (idx, e) => {
    e?.stopPropagation();
    const scene = scenes[idx];
    if (!scene) return;

    if (playingAudioIdx === idx) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
        audioPlayerRef.current = null;
      }
      setPlayingAudioIdx(null);
      return;
    }

    try {
      let audioUrl = scene.audioUrl;
      if (!audioUrl) {
        const res = await api.post('/social-media/ai-video/generate-tts', {
          text: scene.scriptText,
          language: voiceSettings.language,
          speed: voiceSettings.speed
        });
        audioUrl = res.data.audioUrl;
        const updated = [...scenes];
        updated[idx].audioUrl = audioUrl;
        updated[idx].estimatedDuration = res.data.duration;
        setScenes(updated);
      }

      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }

      const fullUrl = getMediaUrl(audioUrl);
      const audio = new Audio(fullUrl);
      audioPlayerRef.current = audio;
      setPlayingAudioIdx(idx);

      audio.play().catch(e => console.warn('Audio play error:', e));
      audio.onended = () => {
        setPlayingAudioIdx(null);
      };
    } catch (err) {
      console.error('Failed to play scene voice audio:', err);
      setPlayingAudioIdx(null);
    }
  };

  // 3. Search Stock Footages Modal
  const openFootageModal = async (sceneIdx) => {
    setActiveSceneIdxForFootage(sceneIdx);
    setIsFootageModalOpen(true);
    const initialQuery = scenes[sceneIdx]?.visualKeyword || 'campus students';
    setStockSearchQuery(initialQuery);
    searchStockVideos(initialQuery);
  };

  const searchStockVideos = async (queryText) => {
    setIsSearchingStock(true);
    try {
      const res = await api.post('/social-media/ai-video/search-footages', {
        query: queryText
      });
      if (res.data?.footages) {
        setStockSearchResults(res.data.footages);
      }
    } catch (err) {
      console.error('Failed to search stock:', err);
    } finally {
      setIsSearchingStock(false);
    }
  };

  const handleSelectFootageForScene = (selectedFootage) => {
    if (activeSceneIdxForFootage === null) return;
    const updated = [...scenes];
    updated[activeSceneIdxForFootage].footage = selectedFootage;
    setScenes(updated);
    setIsFootageModalOpen(false);
  };

  // Custom User Footage Upload per Scene
  const handleCustomFootageUpload = async (e, sceneIdx) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('footage', file);

    try {
      const res = await api.post('/social-media/ai-video/upload-footage', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.footage) {
        const updated = [...scenes];
        updated[sceneIdx].footage = res.data.footage;
        setScenes(updated);
      }
    } catch (err) {
      console.error('Footage upload failed:', err);
      alert('Failed to upload custom video clip.');
    }
  };

  // 4. Scene Manipulations
  const handleSceneTextChange = (idx, field, value) => {
    const updated = [...scenes];
    updated[idx][field] = value;
    if (field === 'scriptText') {
      updated[idx].audioUrl = null; // Invalidate previous TTS cache
    }
    setScenes(updated);
  };

  const handleAddScene = () => {
    const newScene = {
      id: `scene-${scenes.length + 1}`,
      sceneNumber: scenes.length + 1,
      scriptText: 'New voiceover spoken line for this scene.',
      caption: 'HIGHLIGHT CAPTION',
      visualKeyword: 'campus university student',
      estimatedDuration: 5,
      footage: stockSearchResults[0] || null,
      audioUrl: null
    };
    setScenes([...scenes, newScene]);
  };

  const handleDeleteScene = (idx) => {
    if (scenes.length <= 1) {
      alert('Video must have at least 1 scene.');
      return;
    }
    const updated = scenes.filter((_, i) => i !== idx).map((s, i) => ({
      ...s,
      sceneNumber: i + 1
    }));
    setScenes(updated);
  };

  // 5. In-Browser Interactive Simulated Preview
  const toggleLivePreview = () => {
    if (isPreviewPlaying) {
      setIsPreviewPlaying(false);
      clearTimeout(previewTimerRef.current);
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
    } else {
      setIsPreviewPlaying(true);
      playPreviewScene(0);
    }
  };

  const playPreviewScene = (idx) => {
    if (idx >= scenes.length) {
      setIsPreviewPlaying(false);
      setPreviewCurrentSceneIdx(0);
      return;
    }

    setPreviewCurrentSceneIdx(idx);
    const currentScene = scenes[idx];
    const duration = (currentScene.estimatedDuration || 5) * 1000;

    if (currentScene.audioUrl) {
      const fullUrl = getMediaUrl(currentScene.audioUrl);
      const audio = new Audio(fullUrl);
      audioPlayerRef.current = audio;
      audio.play().catch(e => console.warn('Preview audio error:', e));
    }

    previewTimerRef.current = setTimeout(() => {
      playPreviewScene(idx + 1);
    }, duration);
  };

  useEffect(() => {
    return () => {
      clearTimeout(previewTimerRef.current);
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
    };
  }, []);

  // 6. Full End-to-End Server-Side FFmpeg Render
  const handleStartRender = async () => {
    if (scenes.length === 0) {
      alert('Please generate or add scenes before rendering.');
      return;
    }

    setIsRendering(true);
    setRenderError(null);
    setRenderedVideoData(null);
    setActiveStep(4);

    // Progress animation stages
    setRenderProgressStage('Synthesizing Neural Voiceovers & Timings...');
    
    try {
      setTimeout(() => setRenderProgressStage('Downloading & Pre-processing HD Clips...'), 2500);
      setTimeout(() => setRenderProgressStage(`Cropping to ${aspectRatio} Aspect Ratio with 60fps Motion...`), 5000);
      setTimeout(() => setRenderProgressStage('Generating Dynamic Bouncing Viral Subtitles...'), 8000);
      setTimeout(() => setRenderProgressStage('Mixing Background Music & Mastering 1080p MP4...'), 11000);

      const payload = {
        scenes: scenes.map(s => ({
          ...s,
          language: voiceSettings.language
        })),
        aspectRatio,
        subtitleStyle,
        bgmTrackId: bgmTrack,
        bgmVolume,
        videoTitle: videoTitle || 'IMA_Viral_Promo'
      };

      const res = await api.post('/social-media/ai-video/render-video', payload);

      if (res.data && res.data.success) {
        setRenderedVideoData(res.data);
        setRenderProgressStage('Done');
      } else {
        throw new Error(res.data?.error || 'Render failed on server.');
      }
    } catch (err) {
      console.error('[AI Video Render Error]:', err);
      setRenderError(err.response?.data?.error || err.message || 'Video rendering failed.');
    } finally {
      setIsRendering(false);
    }
  };

  const handleCopyShareLink = () => {
    if (!renderedVideoData?.videoUrl) return;
    const fullShareUrl = getMediaUrl(renderedVideoData.videoUrl);
    navigator.clipboard.writeText(fullShareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      
      {/* Studio Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950/80 to-purple-950/60 border border-slate-800 rounded-3xl p-6 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -mb-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-cyan-400 p-0.5 shadow-lg shadow-purple-500/20 shrink-0">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Wand2 className="text-fuchsia-400 animate-pulse" size={28} />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-white tracking-tight">Automated AI Video Creator Studio</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white shadow-sm">
                  PRO AI ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Transform scripts & topics into fully edited viral videos with authentic copyright-free stock footages, AI voice, and animated subtitles.
              </p>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800/80 p-1.5 rounded-2xl">
            {[
              { num: 1, label: '1. Script & Topic' },
              { num: 2, label: '2. Style & Voice' },
              { num: 3, label: '3. Storyboard & Scenes' },
              { num: 4, label: '4. Render & Export' }
            ].map(step => (
              <button
                key={step.num}
                onClick={() => setActiveStep(step.num)}
                disabled={step.num > 2 && scenes.length === 0}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeStep === step.num
                    ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-md'
                    : step.num <= (scenes.length > 0 ? 3 : 2)
                      ? 'text-slate-300 hover:text-white hover:bg-white/5'
                      : 'text-slate-600 cursor-not-allowed'
                }`}
              >
                {step.num < activeStep && scenes.length > 0 ? (
                  <CheckCircle2 size={13} className="text-emerald-400" />
                ) : null}
                <span>{step.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: SCRIPT & TOPIC PROMPT INPUT */}
      {/* ========================================================================= */}
      {activeStep === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-xl flex flex-col gap-5">
              
              {/* Input Mode Selector */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setInputMode('script')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      inputMode === 'script'
                        ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/20'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Paste My Own Script
                  </button>
                  <button
                    onClick={() => setInputMode('prompt')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      inputMode === 'prompt'
                        ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Sparkles size={14} /> Write with Gemini AI
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Language:</span>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-fuchsia-500"
                  >
                    <option value="si">Sinhala (ස්වභාවික සිංහල)</option>
                    <option value="en">English (US/UK)</option>
                    <option value="singlish">Singlish (Sinhala in English letters)</option>
                  </select>
                </div>
              </div>

              {/* Main Textarea */}
              {inputMode === 'script' ? (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">
                    Enter Your Video Script or Spoken Narration:
                  </label>
                  <textarea
                    rows={8}
                    value={userScript}
                    onChange={(e) => setUserScript(e.target.value)}
                    placeholder="ඔබත් A/L විභාගයට සූදානම් වන සිසුවෙක්ද? සාර්ථක ප්‍රතිඵලයක් ලබාගැනීමට දැන්ම IMA Campus වෙත සම්බන්ධ වන්න..."
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500 transition-all font-sans leading-relaxed custom-scrollbar"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>AI will automatically split this into visual scenes with voice & captions.</span>
                    <span>{userScript.length} characters</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-300">
                    Enter Your Topic, Campaign Idea, or Promotion Details:
                  </label>
                  <textarea
                    rows={8}
                    value={promptTopic}
                    onChange={(e) => setPromptTopic(e.target.value)}
                    placeholder="E.g., Create a 30s viral reel explaining why IMA Fast Track is the best choice for A/L Commerce students with a strong hook and register CTA."
                    className="w-full bg-slate-950/80 border border-slate-800 rounded-2xl p-4 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition-all font-sans leading-relaxed custom-scrollbar"
                  />
                </div>
              )}

              {/* Quick Template Prompts */}
              {inputMode === 'prompt' && (
                <div className="flex flex-col gap-2">
                  <span className="text-[11px] font-bold text-slate-400">Quick Template Ideas:</span>
                  <div className="flex flex-wrap gap-2">
                    {[
                      'A/L Exam Motivation & Fast Track Course',
                      'The CIA Gateway Process & Brain Synchronization',
                      'Top 3 Tech Skills for Higher Salaries',
                      'Free Seminar CRM Invitation Reel'
                    ].map(tpl => (
                      <button
                        key={tpl}
                        onClick={() => setPromptTopic(tpl)}
                        className="text-[11px] bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl border border-slate-700/50 transition-all cursor-pointer"
                      >
                        + {tpl}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={handleGenerateStoryboard}
                disabled={isGeneratingStoryboard}
                className="w-full py-4 rounded-2xl font-black text-sm text-white bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-500 hover:opacity-95 shadow-xl shadow-fuchsia-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isGeneratingStoryboard ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Gemini AI Decomposing Storyboard & Finding Footages...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>✨ Generate AI Storyboard & Visuals</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Settings & Duration */}
          <div className="flex flex-col gap-6">
            
            {/* Target Duration Selector */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <FastForward size={14} className="text-fuchsia-400" /> Target Video Duration
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { sec: 15, label: '15 Seconds', desc: 'Short Hook (Reel)' },
                  { sec: 30, label: '30 Seconds', desc: 'Optimal Viral Length' },
                  { sec: 45, label: '45 Seconds', desc: 'Detailed Promo' },
                  { sec: 60, label: '60 Seconds', desc: 'Full Explainer' }
                ].map(item => (
                  <button
                    key={item.sec}
                    onClick={() => setTargetDuration(item.sec)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      targetDuration === item.sec
                        ? 'bg-fuchsia-950/60 border-fuchsia-500/60 text-white shadow-lg'
                        : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-sm font-black">{item.label}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Platform Aspect Ratio Selector */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col gap-4">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Smartphone size={14} className="text-cyan-400" /> Aspect Ratio & Format
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { ratio: '9:16', label: '9:16 Vertical', icon: Smartphone, desc: 'TikTok, Reels, Shorts' },
                  { ratio: '16:9', label: '16:9 Landscape', icon: Monitor, desc: 'YouTube, Web' },
                  { ratio: '1:1', label: '1:1 Square', icon: Square, desc: 'Instagram Post' }
                ].map(fmt => {
                  const Icon = fmt.icon;
                  const isSelected = aspectRatio === fmt.ratio;
                  return (
                    <button
                      key={fmt.ratio}
                      onClick={() => setAspectRatio(fmt.ratio)}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/60 border-cyan-500/60 text-white shadow-lg'
                          : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <Icon size={20} className={isSelected ? 'text-cyan-400' : 'text-slate-500'} />
                      <div className="text-[11px] font-bold">{fmt.ratio}</div>
                      <div className="text-[9px] text-slate-500 leading-tight">{fmt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: STYLE, VOICE & CAPTIONS */}
      {/* ========================================================================= */}
      {activeStep === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Subtitle Style Presets */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-amber-400" /> Animated Subtitle Styling
                </h3>
                <span className="text-xs text-slate-400">Viral TikTok Bounce Effect Included</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: 'tiktok', name: 'TikTok Viral Yellow', color: '#FFFF00', stroke: '#000000', preview: 'GROWTH' },
                  { id: 'neon', name: 'Cyberpunk Neon', color: '#00FFFF', stroke: '#FF00FF', preview: 'FUTURE' },
                  { id: 'gold', name: 'Luxury Gold', color: '#FFD700', stroke: '#000000', preview: 'SUCCESS' },
                  { id: 'clean', name: 'Minimal Crisp White', color: '#FFFFFF', stroke: '#000000', preview: 'CAMPUS' }
                ].map(st => (
                  <button
                    key={st.id}
                    onClick={() => setSubtitleStyle(prev => ({ ...prev, preset: st.id, color: st.color, strokeColor: st.stroke }))}
                    className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                      subtitleStyle.preset === st.id
                        ? 'bg-amber-950/40 border-amber-500/60 shadow-lg'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div 
                      className="text-lg font-black tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] animate-pulse"
                      style={{ color: st.color, textShadow: `-1px -1px 0 ${st.stroke}, 1px -1px 0 ${st.stroke}, -1px 1px 0 ${st.stroke}, 1px 1px 0 ${st.stroke}` }}
                    >
                      {st.preview}
                    </div>
                    <span className="text-[11px] font-bold text-slate-300">{st.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Background Music Track Selector */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Music size={16} className="text-emerald-400" /> Background Music (Royalty-Free)
                </h3>
                <div className="flex items-center gap-2">
                  <Volume2 size={14} className="text-slate-400" />
                  <input
                    type="range"
                    min="0.05"
                    max="0.40"
                    step="0.01"
                    value={bgmVolume}
                    onChange={(e) => setBgmVolume(parseFloat(e.target.value))}
                    className="w-24 accent-emerald-500 cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 font-mono">{Math.round(bgmVolume * 100)}%</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bgmTracksList.map(track => (
                  <div
                    key={track.id}
                    onClick={() => setBgmTrack(track.id)}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-3 transition-all cursor-pointer ${
                      bgmTrack === track.id
                        ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-black text-white">{track.name}</div>
                      <div className="text-[10px] text-slate-500">{track.genre} • {track.duration}s</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const fullAudio = getMediaUrl(track.audioUrl);
                        const audio = new Audio(fullAudio);
                        audio.play().catch(e => console.warn(e));
                      }}
                      className="w-8 h-8 rounded-full bg-slate-800 hover:bg-emerald-600 text-white flex items-center justify-center text-xs transition-all"
                      title="Preview BGM"
                    >
                      <Play size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Style Summary */}
          <div className="flex flex-col gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Style Summary</h3>
              <div className="flex flex-col gap-2.5 text-xs text-slate-300">
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-500">Aspect Ratio</span>
                  <span className="font-bold text-white">{aspectRatio}</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-500">Captions</span>
                  <span className="font-bold text-amber-400 capitalize">{subtitleStyle.preset} Pop-In</span>
                </div>
                <div className="flex justify-between py-1.5 border-b border-slate-800">
                  <span className="text-slate-500">Audio Voice</span>
                  <span className="font-bold text-cyan-400">Google Neural TTS</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-500">Scenes Ready</span>
                  <span className="font-bold text-fuchsia-400">{scenes.length} Scenes</span>
                </div>
              </div>

              <button
                onClick={() => setActiveStep(3)}
                className="w-full mt-2 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-90 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg"
              >
                <span>Continue to Storyboard & Scenes</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: STORYBOARD & SCENE TIMELINE EDITOR */}
      {/* ========================================================================= */}
      {activeStep === 3 && (
        <div className="flex flex-col gap-6 animate-fade-in">
          
          {/* Action Header */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <input
                type="text"
                value={videoTitle}
                onChange={(e) => setVideoTitle(e.target.value)}
                className="bg-transparent text-lg font-black text-white focus:outline-none border-b border-transparent focus:border-fuchsia-500 px-1 py-0.5"
                placeholder="Video Title"
              />
              <p className="text-xs text-slate-400 px-1 mt-0.5">{scenes.length} Scenes • Approx {scenes.reduce((acc, s) => acc + (s.estimatedDuration || 5), 0)}s total</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={toggleLivePreview}
                className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2.5 rounded-2xl border border-slate-700 flex items-center gap-2 transition-all cursor-pointer"
              >
                {isPreviewPlaying ? <Pause size={14} className="text-amber-400" /> : <Play size={14} className="text-cyan-400" />}
                <span>{isPreviewPlaying ? 'Stop Live Preview' : 'Interactive Preview'}</span>
              </button>

              <button
                onClick={handleStartRender}
                className="bg-gradient-to-r from-fuchsia-600 via-purple-600 to-emerald-500 text-white text-xs font-black px-5 py-2.5 rounded-2xl shadow-lg shadow-fuchsia-600/20 hover:opacity-95 flex items-center gap-2 transition-all cursor-pointer"
              >
                <Film size={15} />
                <span>🎬 Render & Export Final HD Video</span>
              </button>
            </div>
          </div>

          {/* Scenes Timeline Editor */}
          <div className="flex flex-col gap-4">
            {scenes.map((scene, idx) => {
              const isImage = scene.footage?.isImage || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(scene.footage?.videoUrl || '');
              return (
                <div
                  key={scene.id || idx}
                  className={`bg-slate-900/80 border rounded-3xl p-5 shadow-xl flex flex-col md:flex-row gap-5 transition-all ${
                    previewCurrentSceneIdx === idx && isPreviewPlaying
                      ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/20 bg-slate-900'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Footage Preview Card */}
                  <div className="w-full md:w-[240px] shrink-0 flex flex-col gap-2">
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 group shadow-inner">
                      {scene.footage?.videoUrl ? (
                        isImage ? (
                          <img
                            src={getMediaUrl(scene.footage.thumbnail || scene.footage.videoUrl)}
                            alt={scene.footage.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-all duration-700"
                          />
                        ) : (
                          <video
                            src={getMediaUrl(scene.footage.videoUrl)}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            onMouseEnter={(e) => e.target.play().catch(() => {})}
                            onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                          />
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                          No Footage Attached
                        </div>
                      )}

                      {/* Scene Badge */}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-sm text-[10px] font-black text-white border border-white/10">
                        Scene {scene.sceneNumber || idx + 1}
                      </div>

                      {/* Media Type Tag */}
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-slate-900/80 text-[9px] font-bold text-slate-300 border border-white/10 flex items-center gap-1">
                        {isImage ? <ImageIcon size={10} className="text-cyan-400" /> : <Video size={10} className="text-purple-400" />}
                        <span>{isImage ? 'Photo Motion' : 'Video Clip'}</span>
                      </div>

                      {/* Duration Tag */}
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-fuchsia-950/80 text-[10px] font-bold text-fuchsia-300 border border-fuchsia-500/30">
                        {scene.estimatedDuration || 5}s
                      </div>
                    </div>

                    {/* Swap / Upload Buttons */}
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => openFootageModal(idx)}
                        className="text-[10px] font-bold bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <Search size={11} /> Swap Clip
                      </button>

                      <label className="text-[10px] font-bold bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 py-1.5 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer">
                        <UploadCloud size={11} /> Upload
                        <input
                          type="file"
                          accept="video/*,image/*"
                          onChange={(e) => handleCustomFootageUpload(e, idx)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Scene Content Inputs */}
                  <div className="flex-1 flex flex-col justify-between gap-3">
                    <div className="flex flex-col gap-3">
                      
                      {/* Voiceover Script Text */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                            <Mic size={12} className="text-cyan-400" /> Spoken Voiceover Script:
                          </label>
                          <button
                            onClick={(e) => handlePlaySceneAudio(idx, e)}
                            className="text-[10px] font-bold bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                          >
                            {playingAudioIdx === idx ? <Pause size={10} /> : <Play size={10} />}
                            <span>{playingAudioIdx === idx ? 'Playing Voice...' : 'Preview Voice'}</span>
                          </button>
                        </div>
                        <textarea
                          rows={2}
                          value={scene.scriptText}
                          onChange={(e) => handleSceneTextChange(idx, 'scriptText', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-fuchsia-500 transition-all font-sans leading-relaxed"
                          placeholder="What the AI voice will say in this scene..."
                        />
                      </div>

                      {/* Highlight Caption */}
                      <div>
                        <label className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 mb-1">
                          <Sparkles size={12} className="text-amber-400" /> On-Screen Bold Caption:
                        </label>
                        <input
                          type="text"
                          value={scene.caption}
                          onChange={(e) => handleSceneTextChange(idx, 'caption', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-amber-300 uppercase tracking-wider focus:outline-none focus:border-amber-500 transition-all"
                          placeholder="ON-SCREEN HIGHLIGHT TEXT"
                        />
                      </div>

                    </div>

                    {/* Scene Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        <span>Keyword: <strong className="text-slate-400">{scene.visualKeyword}</strong></span>
                      </div>
                      <button
                        onClick={() => handleDeleteScene(idx)}
                        className="text-slate-600 hover:text-red-400 p-1 rounded-lg transition-all cursor-pointer"
                        title="Delete Scene"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Scene Button */}
          <button
            onClick={handleAddScene}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/40 text-slate-400 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Plus size={16} /> Add Next Scene
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: RENDER & EXPORT FINAL VIDEO */}
      {/* ========================================================================= */}
      {activeStep === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center animate-fade-in">
          
          {/* Left: Video Player Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className={`relative rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl ${
              aspectRatio === '9:16' ? 'w-[320px] aspect-[9/16]' : aspectRatio === '16:9' ? 'w-full aspect-[16/9]' : 'w-[400px] aspect-square'
            }`}>
              {isRendering ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-950/90 gap-4">
                  <div className="w-16 h-16 rounded-full border-4 border-fuchsia-500 border-t-transparent animate-spin flex items-center justify-center">
                    <Film size={20} className="text-fuchsia-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white mb-1">Rendering Video...</h4>
                    <p className="text-xs text-fuchsia-300 font-mono animate-pulse">{renderProgressStage}</p>
                  </div>
                </div>
              ) : renderedVideoData?.videoUrl ? (
                <video
                  src={getMediaUrl(renderedVideoData.videoUrl)}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-xs p-6 text-center">
                  <Film size={36} className="mb-2 text-slate-700" />
                  <span>Click Render to Export Full HD Video</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Export & Action Center */}
          <div className="flex flex-col gap-6">
            
            {renderedVideoData && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Video Render Complete!</h3>
                    <p className="text-xs text-slate-400">Duration: {renderedVideoData.duration?.toFixed(1)}s | Format: {aspectRatio} MP4</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                  <a
                    href={getMediaUrl(renderedVideoData.downloadUrl)}
                    download
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
                  >
                    <Download size={16} /> Download High-Definition MP4
                  </a>

                  <button
                    onClick={handleCopyShareLink}
                    className="w-full py-3 rounded-2xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    <span>{isCopied ? 'Copied to Clipboard!' : 'Copy Video Share Link'}</span>
                  </button>
                </div>
              </div>
            )}

            {renderError && (
              <div className="bg-red-950/40 border border-red-500/40 rounded-3xl p-6 flex items-start gap-3 text-red-300 text-xs">
                <AlertCircle size={20} className="shrink-0 text-red-400" />
                <div>
                  <h4 className="font-bold text-red-200 mb-1">Rendering Error</h4>
                  <p>{renderError}</p>
                </div>
              </div>
            )}

            {/* Back to Edit Button */}
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <button
                onClick={() => setActiveStep(3)}
                className="hover:text-white transition-all cursor-pointer"
              >
                ← Edit Storyboard Again
              </button>
              <button
                onClick={() => {
                  setScenes([]);
                  setUserScript('');
                  setPromptTopic('');
                  setRenderedVideoData(null);
                  setActiveStep(1);
                }}
                className="hover:text-fuchsia-400 transition-all cursor-pointer font-bold"
              >
                + Create New Video
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STOCK FOOTAGE SWAPPER MODAL */}
      {/* ========================================================================= */}
      {isFootageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white">Select Video Footage or Photo Motion</h3>
                <p className="text-xs text-slate-400">Search royalty-free clips for Scene {(activeSceneIdxForFootage || 0) + 1}</p>
              </div>
              <button
                onClick={() => setIsFootageModalOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl"
              >
                ✕
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center gap-2">
              <Search size={16} className="text-slate-500" />
              <input
                type="text"
                value={stockSearchQuery}
                onChange={(e) => setStockSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchStockVideos(stockSearchQuery)}
                placeholder="Search keywords (e.g. brain universe, classroom, coding, students)..."
                className="bg-transparent flex-1 text-xs text-white focus:outline-none"
              />
              <button
                onClick={() => searchStockVideos(stockSearchQuery)}
                className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl cursor-pointer"
              >
                Search
              </button>
            </div>

            {/* Modal Results Grid */}
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 sm:grid-cols-3 gap-4 custom-scrollbar">
              {isSearchingStock ? (
                <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                  <Loader2 size={24} className="animate-spin text-fuchsia-400" />
                  <span>Searching online and curated library...</span>
                </div>
              ) : stockSearchResults.length > 0 ? (
                stockSearchResults.map(item => {
                  const isImage = item.isImage || /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(item.videoUrl || '');
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectFootageForScene(item)}
                      className="group bg-slate-950 border border-slate-800 hover:border-fuchsia-500 rounded-2xl overflow-hidden flex flex-col cursor-pointer transition-all shadow-md"
                    >
                      <div className="relative aspect-video overflow-hidden bg-black">
                        {isImage ? (
                          <img
                            src={getMediaUrl(item.thumbnail || item.videoUrl)}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
                          />
                        ) : (
                          <video
                            src={getMediaUrl(item.videoUrl)}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            onMouseEnter={(e) => e.target.play().catch(() => {})}
                            onMouseLeave={(e) => { e.target.pause(); e.target.currentTime = 0; }}
                          />
                        )}
                        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/70 text-[9px] font-bold text-white">
                          {isImage ? 'Photo' : 'Video'}
                        </div>
                      </div>
                      <div className="p-2.5">
                        <div className="text-[11px] font-bold text-white truncate">{item.title}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5">{item.category}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                  No stock footages found. Try a different search keyword.
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

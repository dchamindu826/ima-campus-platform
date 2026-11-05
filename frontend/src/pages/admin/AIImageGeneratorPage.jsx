import React, { useState, useEffect, useRef } from 'react';
import {
  Wand2, Image as ImageIcon, Sparkles, Download, Copy, Check,
  RefreshCw, Trash2, UploadCloud, Eye, Maximize2, X, Sliders,
  Smartphone, Monitor, Square, Layers, AlertCircle, ArrowRight,
  Info, History, ExternalLink, Flame, Type, AlignLeft, AlignCenter, AlignRight, Palette
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function AIImageGeneratorPage({ loggedInUser }) {
  // Access Guard: Super Admin Only
  const roleUpper = (loggedInUser?.role || '').toUpperCase();
  const isSuperAdmin = roleUpper === 'SYSTEM_ADMIN' || roleUpper === 'SUPER' || roleUpper === 'ADMIN' || roleUpper === 'DIRECTOR' || roleUpper === 'SYSTEM ADMIN';

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-6">
        <div className="bg-slate-900/80 border border-red-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-white mb-2">Super Admin Access Only</h2>
          <p className="text-xs text-slate-400 mb-6">
            LUMI AI Image Generator is currently restricted to Super Admin accounts only.
          </p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-all border border-white/10"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Input State
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1'); // '1:1' | '9:16' | '16:9'
  const [stylePreset, setStylePreset] = useState('photorealistic');
  const [selectedModel, setSelectedModel] = useState('pollinations-flux');
  
  // Reference Images (Up to 3 images)
  const [referenceImages, setReferenceImages] = useState([]); // [{ id, data: base64, name, size }]
  const fileInputRef = useRef(null);

  // Output / Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [generationHistory, setGenerationHistory] = useState([]);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [generationStep, setGenerationStep] = useState('');

  // 🎨 Sinhala Typography & Text Overlay Studio State
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [bannerTitle, setBannerTitle] = useState('');
  const [bannerSubtitle, setBannerSubtitle] = useState('');
  const [bannerBadge, setBannerBadge] = useState('');
  const [textStyle, setTextStyle] = useState('yellow'); // 'yellow' | 'white' | 'gold' | 'neon'
  const [textPosition, setTextPosition] = useState('left'); // 'left' | 'center' | 'right'
  const canvasRef = useRef(null);

  // Aspect Ratio Presets
  const ASPECT_RATIOS = [
    {
      id: '1:1',
      name: '1:1 Square',
      subtitle: '1080 × 1080',
      description: 'Instagram & Facebook Feed Posts',
      icon: Square,
      frameClass: 'aspect-square w-full max-w-[420px]'
    },
    {
      id: '9:16',
      name: '9:16 Vertical',
      subtitle: '1080 × 1920',
      description: 'Reels, Stories, TikTok & Shorts',
      icon: Smartphone,
      frameClass: 'aspect-[9/16] w-full max-w-[340px]'
    },
    {
      id: '16:9',
      name: '16:9 Landscape',
      subtitle: '1920 × 1080',
      description: 'YouTube, Web Banners & Desktop',
      icon: Monitor,
      frameClass: 'aspect-[16/9] w-full max-w-[560px]'
    }
  ];

  // Style Presets
  const STYLE_PRESETS = [
    { id: 'photorealistic', name: '📸 Photorealistic 8K', desc: 'Ultra-detailed real life photo' },
    { id: 'cinematic', name: '🎬 Cinematic Movie', desc: 'Dramatic 35mm lighting & depth' },
    { id: 'marketing-poster', name: '📢 Marketing Flyer', desc: 'Commercial education graphic design' },
    { id: '3d-render', name: '✨ 3D Pixar / CGI', desc: 'Vibrant octane 3D render' },
    { id: 'cyberpunk', name: '⚡ Cyberpunk Neon', desc: 'Futuristic sci-fi glow' },
    { id: 'anime', name: '🎨 Modern Anime', desc: 'Makoto Shinkai aesthetic' },
    { id: 'minimalist', name: '🌿 Minimalist', desc: 'Clean, elegant & spacious' }
  ];

  // Quick Inspiration Prompts
  const INSPIRATION_TAGS = [
    {
      label: '🎓 Modern Campus Life',
      text: 'A vibrant, modern Sri Lankan university campus courtyard with university students smiling, carrying laptops and backpacks in golden hour sunlight, 8k photorealistic'
    },
    {
      label: '📢 Admission Open Flyer',
      text: 'A sleek modern education advertisement flyer banner for IMA Campus featuring a focused student in a high-tech learning studio with holographic floating charts'
    },
    {
      label: '💻 Tech & AI Hub',
      text: 'Futuristic AI software development lab in an academic institute with developers collaborating in front of glowing multi-screen workstations'
    },
    {
      label: '🏆 Graduation Victory',
      text: 'Excited Sri Lankan university graduates throwing their graduation caps in the air in front of a majestic modern campus hall, confetti and lens flare'
    },
    {
      label: '⚡ Neon Cyber Logo',
      text: 'A glowing 3D futuristic emblem of education and knowledge surrounded by electric blue and magenta neon rings on a dark reflective glass podium'
    }
  ];

  // Fetch History on Mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await api.get('/social-media/ai-image/history');
      if (res.data?.history) {
        setGenerationHistory(res.data.history);
      }
    } catch (err) {
      console.warn('Failed to load image history:', err);
    }
  };

  // Handle Reference Images Upload (Max 3)
  const handleReferenceFiles = (files) => {
    const fileList = Array.from(files);
    if (referenceImages.length + fileList.length > 3) {
      toast.error('You can attach up to 3 sample reference images only.');
      return;
    }

    // Auto switch to Gemini Vision for Face/Person preservation when reference images uploaded
    if (selectedModel === 'pollinations-flux') {
      setSelectedModel('gemini-3.1-flash-image');
      toast.success('Switched to Gemini Vision to preserve reference person & face! 📷');
    }

    fileList.forEach(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image.`);
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setReferenceImages(prev => {
          if (prev.length >= 3) return prev;
          return [
            ...prev,
            {
              id: `ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              name: file.name,
              data: e.target.result,
              mimeType: file.type
            }
          ];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const removeReferenceImage = (id) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };

  // AI Prompt Enhancer
  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) {
      toast.error('Please type a basic idea or prompt first!');
      return;
    }

    setIsEnhancing(true);
    try {
      const res = await api.post('/social-media/ai-image/enhance-prompt', {
        rawPrompt: prompt,
        aspectRatio,
        style: stylePreset
      });
      if (res.data?.enhancedPrompt) {
        setPrompt(res.data.enhancedPrompt);
        toast.success('Prompt enhanced with LUMI Magic! ✨');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to enhance prompt');
    } finally {
      setIsEnhancing(false);
    }
  };

  // Generate Image
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter an image prompt description.');
      return;
    }

    setIsGenerating(true);
    setGenerationStep('LUMI analyzing prompt & reference styles...');

    const stepTimer1 = setTimeout(() => {
      setGenerationStep('Engaging LUMI Vision Engine...');
    }, 2500);

    const stepTimer2 = setTimeout(() => {
      setGenerationStep('Synthesizing high-fidelity lighting & textures...');
    }, 6000);

    const stepTimer3 = setTimeout(() => {
      setGenerationStep('Rendering final high-resolution output...');
    }, 10000);

    try {
      const payload = {
        prompt: prompt.trim(),
        aspectRatio,
        stylePreset,
        model: selectedModel,
        referenceImages: referenceImages.map(img => ({
          data: img.data,
          mimeType: img.mimeType
        }))
      };

      const res = await api.post('/social-media/ai-image/generate', payload);

      if (res.data?.success) {
        const fullBaseUrl = (api.defaults.baseURL || '').replace('/api', '');
        const fullUrl = res.data.imageUrl.startsWith('http')
          ? res.data.imageUrl
          : `${fullBaseUrl}${res.data.imageUrl}`;

        const resultObj = {
          ...res.data,
          fullUrl,
          aspectRatio,
          timestamp: new Date().toLocaleTimeString()
        };

        setGeneratedResult(resultObj);
        toast.success('LUMI generated your image successfully! 🎨');

        // If prompt contained Sinhala text, auto-populate the 100% accurate Typography Studio
        if (/[\u0D80-\u0DFF]/.test(prompt)) {
          const partMatch = prompt.match(/(?:[I|V|X\d]+\s*කොටස|Part\s*[\dIVX]+)/i);
          const badgeVal = partMatch ? partMatch[0].trim() : '';

          let clean = prompt
            .replace(/machan|mata|denna|hdala|thumbnail|ekak|title|ekat|dala|wena|monwatma|danna|ep|supiriyatama|ona|menna|meka|include|following|details|Topic|Subtopic|recommended|size|pixels|aspect|ratio|format/gi, '')
            .trim();

          if (badgeVal) {
            clean = clean.replace(partMatch[0], '').trim();
          }

          const segments = clean.split(/[-:\n]+/).map(s => s.trim()).filter(Boolean);
          const titleVal = segments[0] || 'ගිණුම්කරණය - නව සංකල්පනාත්මක රාමුව';
          const subVal = segments.slice(1).join(' - ') || '';

          setBannerTitle(titleVal);
          if (subVal) setBannerSubtitle(subVal);
          if (badgeVal) setBannerBadge(badgeVal);
          setShowTextEditor(true);
        }

        // Refresh History
        fetchHistory();
      } else {
        throw new Error(res.data?.error || 'Generation failed');
      }
    } catch (err) {
      console.error('Image Gen Error:', err);
      toast.error(err.response?.data?.error || err.message || 'LUMI Image generation failed. Please try again.');
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setIsGenerating(false);
      setGenerationStep('');
    }
  };

  // Download Generated Image
  const handleDownload = (imgUrl, filenamePrefix = 'LUMI_Visual') => {
    const link = document.createElement('a');
    link.href = imgUrl;
    link.download = `${filenamePrefix}_${aspectRatio}_${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Download started!');
  };

  // Copy Image to Clipboard
  const handleCopyImage = async (base64OrUrl) => {
    try {
      if (base64OrUrl.startsWith('data:image')) {
        const res = await fetch(base64OrUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        toast.success('LUMI Image copied to clipboard!');
      } else {
        await navigator.clipboard.writeText(base64OrUrl);
        toast.success('Image URL copied to clipboard!');
      }
    } catch (err) {
      navigator.clipboard.writeText(base64OrUrl);
      toast.success('Image reference copied!');
    }
  };

  // Re-render canvas whenever typography controls or generated image changes
  useEffect(() => {
    if (generatedResult) {
      renderCanvasPreview();
    }
  }, [generatedResult, bannerTitle, bannerSubtitle, bannerBadge, textStyle, textPosition, showTextEditor]);

  const renderCanvasPreview = () => {
    if (!generatedResult?.base64 && !generatedResult?.fullUrl) return;
    const imgUrl = generatedResult.base64 || generatedResult.fullUrl;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = aspectRatio === '16:9' ? 1920 : aspectRatio === '9:16' ? 1080 : 1080;
      const h = aspectRatio === '16:9' ? 1080 : aspectRatio === '9:16' ? 1920 : 1080;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      if (bannerTitle || bannerSubtitle || bannerBadge) {
        const isLeft = textPosition === 'left';
        const isCenter = textPosition === 'center';

        const grad = ctx.createLinearGradient(
          isCenter ? 0 : isLeft ? 0 : w,
          0,
          isCenter ? 0 : isLeft ? w * 0.65 : w * 0.35,
          isCenter ? h : 0
        );
        grad.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
        grad.addColorStop(0.7, 'rgba(0, 0, 0, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        const startX = isCenter ? w / 2 : isLeft ? w * 0.08 : w * 0.92;
        ctx.textAlign = isCenter ? 'center' : isLeft ? 'left' : 'right';
        let currentY = h * 0.30;

        // 1. Draw Main Title
        if (bannerTitle) {
          ctx.font = `900 ${Math.round(w * 0.054)}px 'Noto Sans Sinhala', 'Gemunu Libre', 'Segoe UI', sans-serif`;
          ctx.lineWidth = Math.round(w * 0.013);
          ctx.strokeStyle = '#000000';
          ctx.fillStyle = textStyle === 'yellow' ? '#FFE600' : textStyle === 'gold' ? '#FFA500' : textStyle === 'neon' ? '#00f2fe' : '#FFFFFF';
          ctx.lineJoin = 'round';
          ctx.miterLimit = 2;

          const lines = bannerTitle.split('\n');
          lines.forEach(line => {
            ctx.strokeText(line, startX, currentY);
            ctx.fillText(line, startX, currentY);
            currentY += Math.round(w * 0.068);
          });
        }

        // 2. Draw Subtitle
        if (bannerSubtitle) {
          currentY += 15;
          ctx.font = `bold ${Math.round(w * 0.026)}px 'Noto Sans Sinhala', 'Segoe UI', sans-serif`;
          ctx.lineWidth = Math.round(w * 0.007);
          ctx.strokeStyle = '#000000';
          ctx.fillStyle = '#FFFFFF';
          const subLines = bannerSubtitle.split('\n');
          subLines.forEach(line => {
            ctx.strokeText(line, startX, currentY);
            ctx.fillText(line, startX, currentY);
            currentY += Math.round(w * 0.038);
          });
        }

        // 3. Draw Badge Tag
        if (bannerBadge) {
          currentY += 25;
          ctx.font = `900 ${Math.round(w * 0.03)}px 'Noto Sans Sinhala', 'Segoe UI', sans-serif`;
          const metrics = ctx.measureText(bannerBadge);
          const padX = 24;
          const bgW = metrics.width + (padX * 2);
          const bgH = Math.round(w * 0.048);
          const bX = isCenter ? (w / 2) - (bgW / 2) : isLeft ? startX : startX - bgW;

          ctx.fillStyle = textStyle === 'yellow' ? '#FFE600' : '#f43f5e';
          ctx.beginPath();
          if (ctx.roundRect) {
            ctx.roundRect(bX, currentY - (bgH * 0.72), bgW, bgH, 10);
          } else {
            ctx.rect(bX, currentY - (bgH * 0.72), bgW, bgH);
          }
          ctx.fill();

          ctx.fillStyle = '#000000';
          ctx.textAlign = 'left';
          ctx.fillText(bannerBadge, bX + padX, currentY);
        }
      }
    };
    img.src = imgUrl;
  };

  const handleDownloadMergedBanner = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const mergedUrl = canvas.toDataURL('image/jpeg', 0.95);
      handleDownload(mergedUrl, 'LUMI_Sinhala_Banner');
      toast.success('HD Banner with 100% Accurate Sinhala Typography downloaded!');
    } catch (err) {
      toast.error('Failed to export merged canvas. Downloading clean image.');
      handleDownload(generatedResult.base64 || generatedResult.fullUrl, 'LUMI_Visual');
    }
  };

  const getFullUrl = (relativeOrFull) => {
    if (!relativeOrFull) return '';
    if (relativeOrFull.startsWith('http') || relativeOrFull.startsWith('data:')) return relativeOrFull;
    const base = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    const cleanPath = relativeOrFull.startsWith('/') ? relativeOrFull : `/${relativeOrFull}`;
    return `${base}${cleanPath}`;
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Compact Header Banner with Corner Model Selector */}
      <div className="max-w-7xl mx-auto mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-white/10 rounded-xl px-4 py-3 shadow-xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />

          {/* Left Title & Icon */}
          <div className="flex items-center gap-3 relative z-10">
            <span className="p-2 bg-gradient-to-br from-pink-500 via-purple-600 to-cyan-500 rounded-lg shadow-md shadow-pink-500/20 flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-200 to-cyan-200">
                  LUMI Image Generator
                </h1>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Active
                </span>
              </div>
              <p className="text-[11px] text-pink-300/80 font-medium">
                LUMI AI Visual Creation Studio • Powered by LUMI Vision Engine
              </p>
            </div>
          </div>

          {/* Right Corner: Sleek Model Selector */}
          <div className="flex items-center gap-2 relative z-10 self-start sm:self-auto">
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-white/10 hover:border-pink-500/40 rounded-lg px-2.5 py-1.5 shadow-inner transition-all">
              <span className="text-[11px] font-bold text-pink-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-pink-400" />
                <span className="hidden sm:inline">Model:</span>
              </span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                <option value="pollinations-flux" className="bg-slate-900 text-emerald-400 font-bold">🔥 LUMI Flux Engine (100% FREE - $0)</option>
                <option value="imagen-3.0-fast-generate-001" className="bg-slate-900 text-slate-100">⚡ Google Imagen 3 Fast (~$0.003 / image)</option>
                <option value="imagen-3.0-generate-002" className="bg-slate-900 text-slate-100">💎 Google Imagen 3 Standard (~$0.03 / image)</option>
                <option value="gemini-3.1-flash-image" className="bg-slate-900 text-slate-100">✨ Google Gemini 3.1 Vision</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Controls & Prompting (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Aspect Ratio Selector (1:1, 9:16, 16:9) */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-pink-400" />
                1. Select Aspect Ratio & Resolution
              </label>
              <span className="text-xs font-semibold text-pink-300 bg-pink-500/10 px-2.5 py-0.5 rounded-full border border-pink-500/20">
                {aspectRatio} Selected
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {ASPECT_RATIOS.map((ar) => {
                const IconComponent = ar.icon;
                const isSelected = aspectRatio === ar.id;
                return (
                  <button
                    key={ar.id}
                    type="button"
                    onClick={() => setAspectRatio(ar.id)}
                    className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-pink-950/60 to-purple-950/60 border-pink-500 shadow-lg shadow-pink-500/20 ring-1 ring-pink-500'
                        : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <IconComponent className={`w-5 h-5 ${isSelected ? 'text-pink-400' : 'text-slate-400'}`} />
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isSelected ? 'bg-pink-500/30 text-pink-200' : 'bg-white/10 text-slate-400'}`}>
                        {ar.subtitle}
                      </span>
                    </div>
                    <div>
                      <div className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                        {ar.name}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {ar.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-pink-400 shadow-sm" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Sample / Reference Images (Up to 3) */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-pink-400" />
                2. Sample / Reference Images
                <span className="text-xs font-normal text-slate-400">(Optional • Up to 3)</span>
              </label>
              <span className="text-xs text-pink-400 font-medium">
                {referenceImages.length}/3 attached
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Attach sample photos, existing flyers, logos, or character poses to guide LUMI AI's visual style, color palette, and composition.
            </p>

            {/* Upload Area / Previews */}
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {/* Existing Uploaded References */}
              {referenceImages.map((img, index) => (
                <div key={img.id} className="relative group rounded-xl overflow-hidden border border-pink-500/40 bg-slate-900/80 aspect-square shadow-md">
                  <img src={img.data} alt={img.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                    <button
                      type="button"
                      onClick={() => setLightboxImage(img.data)}
                      className="p-1.5 bg-slate-900/90 hover:bg-slate-900 text-white rounded-lg text-xs"
                      title="Preview"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeReferenceImage(img.id)}
                      className="p-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-pink-300 text-[10px] font-bold rounded">
                    Ref #{index + 1}
                  </span>
                </div>
              ))}

              {/* Upload Button */}
              {referenceImages.length < 3 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-xl border-2 border-dashed border-white/20 hover:border-pink-500/60 bg-white/5 hover:bg-pink-950/20 aspect-square flex flex-col items-center justify-center p-3 text-center transition-all group"
                >
                  <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-pink-400 group-hover:scale-110 transition-transform mb-1" />
                  <span className="text-[11px] font-semibold text-slate-300 group-hover:text-pink-300">
                    Add Sample
                  </span>
                  <span className="text-[9px] text-slate-500">Max 3</span>
                </button>
              )}
            </div>

            {referenceImages.length > 0 && (
              <div className="mt-3 p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-xs text-cyan-300 font-semibold animate-fadeIn">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  📷 Person Preservation Mode: Gemini Vision will keep the lecturer's face & blue suit from Ref #1
                </span>
              </div>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              onChange={(e) => {
                if (e.target.files?.length) {
                  handleReferenceFiles(e.target.files);
                  e.target.value = '';
                }
              }}
              className="hidden"
            />
          </div>

          {/* 3. Prompt Builder */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl hover:border-white/15 transition-all space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                3. Describe What You Want to Create
              </label>

              <button
                type="button"
                onClick={handleEnhancePrompt}
                disabled={isEnhancing || !prompt.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-500/20 to-pink-500/20 hover:from-amber-500/30 hover:to-pink-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isEnhancing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                )}
                ✨ LUMI Magic Enhance
              </button>
            </div>

            <div className="relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. A modern futuristic Sri Lankan education institute classroom with students collaborating on laptops, vibrant neon lighting, 8k photorealistic..."
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500 transition-all resize-none shadow-inner"
              />
              <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                <span>Supports Sinhala & English concepts</span>
                <span>{prompt.length} characters</span>
              </div>
            </div>

            {/* Quick Inspiration Chips */}
            <div>
              <div className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-slate-400" /> Quick Idea Starters:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {INSPIRATION_TAGS.map((tag, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setPrompt(tag.text)}
                    className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-pink-900/30 text-slate-300 hover:text-pink-200 border border-white/10 hover:border-pink-500/40 text-xs transition-all"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style Presets Grid */}
            <div>
              <label className="text-xs font-semibold text-slate-400 mb-2 block">
                Visual Art Style Preset:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {STYLE_PRESETS.map((style) => {
                  const isSelected = stylePreset === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setStylePreset(style.id)}
                      className={`p-2 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'bg-pink-950/60 border-pink-500 text-pink-200 shadow-sm'
                          : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{style.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{style.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Generate Action Button */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="w-full py-4 rounded-xl font-extrabold text-base text-white bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600 hover:from-pink-500 hover:via-purple-500 hover:to-cyan-500 shadow-lg shadow-pink-600/30 hover:shadow-pink-600/50 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin text-white" />
                  <span>{generationStep || 'LUMI Generating Visual...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition-transform" />
                  <span>Generate with LUMI AI ({aspectRatio})</span>
                  <ArrowRight className="w-4 h-4 text-pink-200 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Result & History (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">

          {/* Active Generation Preview Box */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                Generated LUMI Visual Output
              </h2>
              {generatedResult && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {generatedResult.aspectRatio} • HD
                </span>
              )}
            </div>

            {/* Image Container with Dynamic Aspect Ratio */}
            <div className="flex items-center justify-center bg-slate-950/60 border border-white/10 rounded-xl p-3 min-h-[360px] relative overflow-hidden">
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full border-4 border-pink-500/20 border-t-pink-500 animate-spin" />
                    <Sparkles className="w-6 h-6 text-pink-400 absolute inset-0 m-auto animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200 text-sm">{generationStep}</h3>
                    <p className="text-xs text-slate-400 mt-1">Rendering with LUMI AI Visual Engine...</p>
                  </div>
                </div>
              ) : generatedResult ? (
                <div className="w-full flex flex-col items-center">
                  
                  {/* Mode Selector Tabs */}
                  <div className="w-full flex items-center justify-between mb-3 bg-slate-950/80 p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowTextEditor(false)}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        !showTextEditor
                          ? 'bg-pink-600 text-white shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      Clean AI Image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTextEditor(true);
                        if (!bannerTitle && prompt) {
                          // Pre-fill if prompt had Sinhala text
                          const lines = prompt.split(/[,\n.]+/).filter(Boolean);
                          if (lines.length > 0) setBannerTitle(lines[0].trim());
                          if (lines.length > 1) setBannerSubtitle(lines[1].trim());
                        }
                      }}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                        showTextEditor
                          ? 'bg-gradient-to-r from-amber-500 to-pink-600 text-white shadow-md'
                          : 'text-amber-400 hover:text-amber-300'
                      }`}
                    >
                      <Type className="w-3.5 h-3.5" />
                      ✨ 100% Accurate Sinhala Text
                    </button>
                  </div>

                  {/* Canvas vs Img Container */}
                  <div className={`relative group rounded-lg overflow-hidden shadow-2xl border border-white/15 bg-black/40 ${
                    aspectRatio === '9:16' ? 'max-h-[500px]' : 'max-h-[420px]'
                  }`}>
                    {showTextEditor ? (
                      <canvas
                        ref={canvasRef}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => {
                          const c = canvasRef.current;
                          if (c) setLightboxImage(c.toDataURL('image/jpeg', 0.95));
                        }}
                      />
                    ) : (
                      <img
                        src={generatedResult.base64 || generatedResult.fullUrl}
                        alt={generatedResult.prompt}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={() => setLightboxImage(generatedResult.base64 || generatedResult.fullUrl)}
                      />
                    )}

                    {/* Hover Overlay Actions */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3 pointer-events-none">
                      <button
                        type="button"
                        onClick={() => {
                          if (showTextEditor && canvasRef.current) {
                            setLightboxImage(canvasRef.current.toDataURL('image/jpeg', 0.95));
                          } else {
                            setLightboxImage(generatedResult.base64 || generatedResult.fullUrl);
                          }
                        }}
                        className="px-3 py-1.5 bg-slate-900/90 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 backdrop-blur-md pointer-events-auto"
                      >
                        <Maximize2 className="w-3.5 h-3.5" /> Fullscreen
                      </button>
                    </div>
                  </div>

                  {/* Sinhala Typography Controls (When in Text Mode) */}
                  {showTextEditor && (
                    <div className="w-full mt-4 p-3.5 bg-slate-950/80 border border-amber-500/30 rounded-xl space-y-3 shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5 text-amber-400" />
                          Sinhala Typography & Badges (0 Spelling Errors)
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">100% Crisp Unicode</span>
                      </div>

                      {/* Title Input */}
                      <div>
                        <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                          Main Headline (Sinhala / English):
                        </label>
                        <input
                          type="text"
                          value={bannerTitle}
                          onChange={(e) => setBannerTitle(e.target.value)}
                          placeholder="e.g. ගිණුම්කරණය - නව සංකල්පනාත්මක රාමුව"
                          className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Subtitle & Badge in 2 Cols */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            Sub-heading / Line 2:
                          </label>
                          <input
                            type="text"
                            value={bannerSubtitle}
                            onChange={(e) => setBannerSubtitle(e.target.value)}
                            placeholder="e.g. සංස්කෘතිතාවබෝධය, මාධ්‍යයේ ස්වභාවය"
                            className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-slate-300 mb-1 block">
                            Part / Badge Tag:
                          </label>
                          <input
                            type="text"
                            value={bannerBadge}
                            onChange={(e) => setBannerBadge(e.target.value)}
                            placeholder="e.g. 1 කොටස • PART 1"
                            className="w-full bg-slate-900 border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                          />
                        </div>
                      </div>

                      {/* Color Preset & Alignment */}
                      <div className="flex items-center justify-between pt-1 gap-2">
                        {/* Style Presets */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setTextStyle('yellow')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                              textStyle === 'yellow'
                                ? 'bg-amber-400 text-black border-amber-300 shadow'
                                : 'bg-slate-900 text-amber-300 border-white/10'
                            }`}
                          >
                            🌟 Yellow
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextStyle('white')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                              textStyle === 'white'
                                ? 'bg-white text-black border-white shadow'
                                : 'bg-slate-900 text-slate-300 border-white/10'
                            }`}
                          >
                            💎 White
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextStyle('gold')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                              textStyle === 'gold'
                                ? 'bg-orange-500 text-white border-orange-400 shadow'
                                : 'bg-slate-900 text-orange-300 border-white/10'
                            }`}
                          >
                            ⚡ Gold
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextStyle('neon')}
                            className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                              textStyle === 'neon'
                                ? 'bg-cyan-400 text-black border-cyan-300 shadow'
                                : 'bg-slate-900 text-cyan-300 border-white/10'
                            }`}
                          >
                            🌀 Cyan
                          </button>
                        </div>

                        {/* Position */}
                        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-white/10">
                          <button
                            type="button"
                            onClick={() => setTextPosition('left')}
                            className={`p-1 rounded ${textPosition === 'left' ? 'bg-pink-600 text-white' : 'text-slate-400'}`}
                            title="Left Align"
                          >
                            <AlignLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextPosition('center')}
                            className={`p-1 rounded ${textPosition === 'center' ? 'bg-pink-600 text-white' : 'text-slate-400'}`}
                            title="Center Align"
                          >
                            <AlignCenter className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setTextPosition('right')}
                            className={`p-1 rounded ${textPosition === 'right' ? 'bg-pink-600 text-white' : 'text-slate-400'}`}
                            title="Right Align"
                          >
                            <AlignRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="w-full flex flex-col gap-2 mt-4">
                    {showTextEditor ? (
                      <button
                        type="button"
                        onClick={handleDownloadMergedBanner}
                        className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-pink-600 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-pink-600/25 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download Banner (100% Perfect Sinhala Text)
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleDownload(generatedResult.base64 || generatedResult.fullUrl, 'LUMI_Visual')}
                        className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download Clean AI Image
                      </button>
                    )}

                    <div className="w-full grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleDownload(generatedResult.base64 || generatedResult.fullUrl, 'LUMI_Clean_Visual')}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-all"
                      >
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400" />
                        Download Clean BG
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyImage(generatedResult.base64 || generatedResult.fullUrl)}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-all"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-400" />
                        Copy Image
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold text-slate-400">No Image Generated Yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">
                    Choose an aspect ratio, optionally attach sample images, type your prompt, and click Generate!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Generations History */}
          <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 shadow-2xl backdrop-blur-xl hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-pink-400" />
                Recent LUMI Creations ({generationHistory.length})
              </h2>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            {generationHistory.length > 0 ? (
              <div className="grid grid-cols-3 gap-2 max-h-[380px] overflow-y-auto pr-1">
                {generationHistory.slice(0, 12).map((item) => (
                  <div
                    key={item.id}
                    className="relative group rounded-xl overflow-hidden border border-white/10 bg-slate-950/60 aspect-square cursor-pointer hover:border-pink-500/60 transition-all"
                    onClick={() => {
                      setGeneratedResult({
                        ...item,
                        fullUrl: getFullUrl(item.imageUrl),
                        base64: getFullUrl(item.imageUrl)
                      });
                      setPrompt(item.prompt);
                      if (item.aspectRatio) setAspectRatio(item.aspectRatio);
                    }}
                  >
                    <img
                      src={`${getFullUrl(item.imageUrl)}?v=${item.id || '1'}`}
                      alt={item.prompt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      onError={(e) => {
                        if (!e.target.dataset.tried) {
                          e.target.dataset.tried = 'true';
                          e.target.src = item.imageUrl;
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                      <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-black/80 text-white w-fit">
                        {item.aspectRatio || '1:1'}
                      </span>
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(getFullUrl(item.imageUrl), 'LUMI_Past');
                          }}
                          className="p-1 bg-slate-800/90 hover:bg-slate-700 text-white rounded text-[10px]"
                          title="Download"
                        >
                          <Download className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightboxImage(getFullUrl(item.imageUrl));
                          }}
                          className="p-1 bg-slate-800/90 hover:bg-slate-700 text-white rounded text-[10px]"
                          title="View"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                No past creations yet. Generated images will appear here!
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Lightbox / Zoom Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={lightboxImage}
              alt="Preview"
              className="max-h-[80vh] w-auto object-contain rounded-xl shadow-2xl border border-white/20"
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleDownload(lightboxImage, 'LUMI_Zoom_Visual')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg"
              >
                <Download className="w-4 h-4" /> Download Full Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

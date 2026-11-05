import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles, Bot, Send, Trash2, Plus, Paperclip, Settings, Copy, Check,
  ChevronDown, RefreshCw, AlertCircle, Video, Code, Brain, PenTool,
  Download, Eye, Image as ImageIcon, X, Zap, Shield, Search, ArrowUpRight,
  Maximize2, Minimize2, Play, Layers, Palette, Terminal, Globe, FileText,
  Smartphone, Tablet, Monitor, ExternalLink, PanelRightClose, PanelRightOpen,
  Sliders, Wand2, Sparkle, Edit3
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../api/axios';
import toast from 'react-hot-toast';

const AVAILABLE_MODELS = [
  {
    id: 'claude-opus-5',
    name: 'Claude Opus 5',
    tagline: 'Flagship 1M Context & Autonomous UI/Code Synthesis',
    badge: '1M Context',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Anthropic\'s most powerful model for large-scale full-stack coding, real-time UI synthesis, and agentic workflows.'
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    tagline: 'Hybrid Reasoning & Ultra-Fast Code Generation',
    badge: 'Fast Reasoning',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    description: 'Blazing fast thinking and elite software engineering capability.'
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    tagline: 'State-of-the-art vision and instruction following',
    badge: 'Benchmark',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    description: 'Top-tier code and text reasoning at optimized speed and cost.'
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    tagline: 'Google Flash Intelligence with massive speed',
    badge: 'Ultra Fast',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    description: 'Low-latency multimodal execution for quick queries and processing.'
  }
];

const PROMPT_TEMPLATES = [
  {
    title: 'Modern SaaS Analytics Dashboard',
    icon: Monitor,
    category: 'UI & Web Dev',
    color: 'from-blue-500/20 to-indigo-600/20 text-blue-300 border-blue-500/30',
    prompt: 'Build a single-file, production-ready Modern SaaS Analytics Dashboard in complete HTML, Tailwind CSS, and vanilla JS. Include a sleek sidebar, dark mode glassmorphism KPI cards, an interactive revenue Chart.js chart, live data tables with search, and interactive notification pills. Ensure the code is self-contained and runnable in one HTML block.'
  },
  {
    title: 'Cinematic AI Video Prompts',
    icon: Video,
    category: 'AI Media Director',
    color: 'from-fuchsia-500/20 to-purple-600/20 text-fuchsia-300 border-fuchsia-500/30',
    prompt: 'Act as a Hollywood AI Cinematographer. Write 3 ultra-detailed prompts for AI video generators (Runway Gen-3, Kling, Google Veo, Sora). Detail exact camera motions (pan/tilt/dolly), lens focal lengths, volumetric cinematic lighting, color grading (Teal & Orange), 60fps pacing, and negative prompt keywords.'
  },
  {
    title: 'Interactive 3D Canvas / Particle Game',
    icon: Play,
    category: 'Interactive Graphics',
    color: 'from-amber-500/20 to-orange-600/20 text-amber-300 border-amber-500/30',
    prompt: 'Write a complete, single-file HTML5 Canvas interactive particle simulation / space arcade game with mouse gravitational physics, glowing neon particles, score counter, power-ups, and particle explosion effects. Make it fully playable inside the browser in one HTML code block.'
  },
  {
    title: 'Generate AI Images & Artworks 🎨',
    icon: Palette,
    category: 'AI Image Engine',
    color: 'from-rose-500/20 to-pink-600/20 text-rose-300 border-rose-500/30',
    prompt: 'Generate a photorealistic 8k Sri Lankan modern higher-education campus with futuristic glass architecture, students collaborating with AI holographic interfaces at golden hour sunset, cinematic lighting, ultra-high resolution.'
  },
  {
    title: 'Intricate Quantum Vector SVG',
    icon: Layers,
    category: 'Vector Art',
    color: 'from-emerald-500/20 to-teal-600/20 text-emerald-300 border-emerald-500/30',
    prompt: 'Create a standalone, highly detailed XML SVG illustration of a glowing Quantum AI Neural Core with intricate geometric circuits, glowing radial gradients, pulsing core nodes, and sleek isometric aesthetics in a single SVG block.'
  },
  {
    title: 'Full-Stack Architecture & Algorithms',
    icon: Brain,
    category: 'Computer Science',
    color: 'from-violet-500/20 to-purple-600/20 text-violet-300 border-violet-500/30',
    prompt: 'Design a distributed rate-limiter and task queue system in Node.js / TypeScript. Provide formal architectural explanations, sliding window algorithms, Redis data structures, and production-grade code with error handling.'
  }
];

const DEFAULT_OPUS_PROMPT = `You are Claude Opus 5, Anthropic's premier frontier AI model, operating as a World-Class Principal Frontend Architect, Creative UI/UX Designer, and Generative AI Creator.

CORE CAPABILITIES:

1. CODE & LIVE ARTIFACTS:
- When asked to build websites, dashboards, landing pages, tools, or interactive web applications, ALWAYS deliver a SINGLE, SELF-CONTAINED, 100% COMPLETE RUNNABLE HTML FILE inside a single \`\`\`html ... \`\`\` block using Tailwind CSS, Chart.js, FontAwesome/Lucide icons, and full JavaScript interactivity.
- Never use placeholders or incomplete code.

2. AI IMAGE GENERATION (NATIVE & INTEGRATED):
- You are directly connected to an elite, high-resolution AI Image Generation Engine (FLUX Pro & Google Imagen 3.0).
- You CAN directly generate AI images, banners, posters, social media posts, UI mockups, illustrations, concept art, and graphics.
- NEVER say "I am a text-based AI and cannot generate images" or "I cannot create images". You HAVE direct image generation capabilities!
- When the user asks to generate, create, make, draw, or visualize an image, photo, banner, poster, or graphic (in English, Sinhala, or Singlish), you MUST output an image generation block in this format:
:::image
prompt: <Comprehensive, high-fidelity visual description in English. Detail the subject, background, lighting, camera angle, color scheme, artistic style, and mood. If Sinhala text or typography is requested, explicitly instruct: "featuring crisp, accurate, bold Sinhala typography reading '<Sinhala text>' with premium high-contrast styling">
aspectRatio: 16:9 | 1:1 | 9:16
style: photorealistic | cinematic | 3d-render | marketing-poster | anime | cyberpunk | minimalist
caption: <Engaging descriptive title for the image in Sinhala or English>
:::
- Accompany the generated image with your insightful, friendly, and comprehensive explanation or creative copy in the requested language (Sinhala, English, or Singlish).`;

export default function ClaudeOpusStudio() {
  const [sessions, setSessions] = useState(() => {
    try {
      const saved = localStorage.getItem('claude_opus_sessions');
      return saved ? JSON.parse(saved) : [{ id: 'default', title: 'New Conversation', messages: [], createdAt: Date.now() }];
    } catch {
      return [{ id: 'default', title: 'New Conversation', messages: [], createdAt: Date.now() }];
    }
  });

  const [activeSessionId, setActiveSessionId] = useState(() => {
    try {
      const saved = localStorage.getItem('claude_active_session_id');
      return saved || 'default';
    } catch {
      return 'default';
    }
  });

  const [selectedModel, setSelectedModel] = useState('claude-opus-5');
  const [inputMessage, setInputMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // AI Image Generation Mode State
  const [isImageMode, setIsImageMode] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState('1:1');
  const [imageStyle, setImageStyle] = useState('photorealistic');
  const [showImageOptions, setShowImageOptions] = useState(false);

  // Artifact Canvas State
  const [activeArtifact, setActiveArtifact] = useState(null); // { type: 'html' | 'svg' | 'react' | 'code' | 'image', code: string, title: string }
  const [isArtifactOpen, setIsArtifactOpen] = useState(false);
  const [artifactTab, setArtifactTab] = useState('preview'); // 'preview' | 'code'
  const [viewportMode, setViewportMode] = useState('desktop'); // 'desktop' | 'tablet' | 'mobile'
  const [isFullScreenArtifact, setIsFullScreenArtifact] = useState(false);
  const [sandboxKey, setSandboxKey] = useState(0);

  // Configuration settings (Pure Claude defaults)
  const [showSettings, setShowSettings] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState(() => {
    const saved = localStorage.getItem('claude_system_prompt');
    if (!saved || !saved.includes('IMAGE GENERATION')) {
      localStorage.setItem('claude_system_prompt', DEFAULT_OPUS_PROMPT);
      return DEFAULT_OPUS_PROMPT;
    }
    return saved;
  });
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(8192);
  const [region, setRegion] = useState('us-east5');
  const [anthropicApiKey, setAnthropicApiKey] = useState(() => localStorage.getItem('anthropic_custom_api_key') || '');
  const [serverStatus, setServerStatus] = useState(null);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    localStorage.setItem('claude_opus_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('claude_active_session_id', activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem('claude_system_prompt', systemPrompt);
  }, [systemPrompt]);

  useEffect(() => {
    localStorage.setItem('anthropic_custom_api_key', anthropicApiKey);
  }, [anthropicApiKey]);

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [sessions, activeSessionId, isLoading]);

  const fetchStatus = async () => {
    try {
      const res = await api.get('/claude/status');
      setServerStatus(res.data);
    } catch (err) {
      console.warn('Failed to fetch status:', err.message);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  // Image URL normalizer for Claude Opus Studio
  const resolveStudioImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    if (url.startsWith('/uploads/social-media/generated-images/')) return url;
    const clean = url.split('?')[0];
    const filename = clean.split('/').pop();
    if (filename && (filename.startsWith('gen_') || filename.endsWith('.jpg') || filename.endsWith('.png') || filename.endsWith('.jpeg') || filename.endsWith('.webp'))) {
      return `/uploads/social-media/generated-images/${filename}`;
    }
    if (url.startsWith('/uploads/')) {
      const stripped = url.replace('/uploads/generated/', '').replace('/uploads/', '');
      return `/uploads/social-media/generated-images/${stripped}`;
    }
    if (url.startsWith('/')) return url;
    return `/uploads/social-media/generated-images/${url}`;
  };

  // Universal Robust Artifact Extractor
  const extractArtifactFromText = (text) => {
    if (!text) return null;

    // 0. Check for Markdown Image (if no full HTML block is present)
    const imgMatch = text.match(/!\[([^\]]*)\]\(([^)\s]+)\)/i);
    if (imgMatch && !text.includes('```html') && !text.includes('<!DOCTYPE')) {
      return {
        type: 'image',
        code: resolveStudioImageUrl(imgMatch[2]),
        title: imgMatch[1] || 'Claude AI Visual Artwork'
      };
    }

    // 1. Check for standard ```html ... ```
    const htmlMatch = text.match(/```(?:html|htm)\s*[\r\n]([\s\S]*?)```/i);
    if (htmlMatch && htmlMatch[1].trim()) {
      return {
        type: 'html',
        code: htmlMatch[1].trim(),
        title: 'Interactive Web Application'
      };
    }

    // 2. Check for XML SVG ```svg ... ``` or direct <svg> tag
    const svgMatch = text.match(/```(?:svg|xml)\s*[\r\n]([\s\S]*?)```/i) || text.match(/(<svg[\s\S]*?<\/svg>)/i);
    if (svgMatch) {
      const svgCode = svgMatch[1] || svgMatch[0];
      if (svgCode && svgCode.includes('<svg')) {
        return {
          type: 'svg',
          code: svgCode.trim(),
          title: 'SVG Vector Graphic'
        };
      }
    }

    // 3. Check for any code block with HTML/JSX or multiple snippets
    const codeBlocks = Array.from(text.matchAll(/```(?:jsx|tsx|javascript|js|react|css)?\s*[\r\n]([\s\S]*?)```/gi));
    if (codeBlocks.length > 0) {
      const combinedCode = codeBlocks.map(b => b[1].trim()).join('\n\n');
      
      const isHtml = combinedCode.includes('<div') || combinedCode.includes('<!DOCTYPE') || combinedCode.includes('<html') || combinedCode.includes('<body') || combinedCode.includes('<section');
      const isReact = combinedCode.includes('className=') || combinedCode.includes('React.') || combinedCode.includes('import ') || combinedCode.includes('export default') || combinedCode.includes('useState(');

      if (isHtml) {
        return {
          type: 'html',
          code: combinedCode,
          title: 'Interactive HTML App'
        };
      } else if (isReact) {
        return {
          type: 'react',
          code: combinedCode,
          title: 'Interactive React App'
        };
      } else if (combinedCode.length > 40) {
        return {
          type: 'code',
          code: combinedCode,
          title: 'Code Artifact'
        };
      }
    }

    return null;
  };

  // Compile Document for iframe sandbox with Babel Standalone, React 18, Tailwind, Lucide, FontAwesome & Chart.js
  const compiledIframeDoc = useMemo(() => {
    if (!activeArtifact || !activeArtifact.code) return '';

    // Mode 0: AI Generated Image Canvas
    if (activeArtifact.type === 'image') {
      const imgUrl = resolveStudioImageUrl(activeArtifact.code);
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <style>
    body { margin: 0; background: #07090E; color: #f3f4f6; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 1.5rem; }
    .canvas-card { background: #0F121C; border: 1px solid rgba(255,255,255,0.12); border-radius: 1.25rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; max-width: 900px; width: 100%; }
    .img-view { max-height: 65vh; width: 100%; object-fit: contain; background: #000; transition: filter 0.2s ease; }
    .control-slider { accent-color: #f59e0b; }
  </style>
</head>
<body>
  <div class="canvas-card">
    <div class="p-4 bg-[#141824] border-b border-white/10 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-amber-500 animate-pulse"></span>
        <span class="font-bold text-sm text-amber-300">Claude Studio Image Canvas 🎨</span>
      </div>
      <div class="flex items-center gap-2">
        <a href="${imgUrl}" download="claude-artwork.jpg" target="_blank" class="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all">
          <i class="fa-solid fa-download"></i> Save Image
        </a>
      </div>
    </div>
    <div class="p-5 flex flex-col items-center">
      <img id="mainImg" src="${imgUrl}" alt="AI Artwork" class="img-view rounded-xl shadow-2xl" />
      <div class="w-full mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#121622] rounded-xl border border-white/5 text-xs text-gray-300">
        <div>
          <label class="flex justify-between mb-1"><span>Brightness</span><span id="brightVal">100%</span></label>
          <input type="range" min="50" max="150" value="100" class="control-slider w-full" oninput="updateFilter('brightness', this.value, '%', 'brightVal')" />
        </div>
        <div>
          <label class="flex justify-between mb-1"><span>Contrast</span><span id="contrastVal">100%</span></label>
          <input type="range" min="50" max="150" value="100" class="control-slider w-full" oninput="updateFilter('contrast', this.value, '%', 'contrastVal')" />
        </div>
        <div>
          <label class="flex justify-between mb-1"><span>Saturation</span><span id="saturateVal">100%</span></label>
          <input type="range" min="0" max="200" value="100" class="control-slider w-full" oninput="updateFilter('saturate', this.value, '%', 'saturateVal')" />
        </div>
      </div>
    </div>
  </div>
  <script>
    const filters = { brightness: 100, contrast: 100, saturate: 100 };
    function updateFilter(name, val, unit, labelId) {
      filters[name] = val;
      document.getElementById(labelId).innerText = val + unit;
      document.getElementById('mainImg').style.filter = 'brightness(' + filters.brightness + '%) contrast(' + filters.contrast + '%) saturate(' + filters.saturate + '%)';
    }
  </script>
</body>
</html>`;
    }

    // Mode 1: SVG Graphic
    if (activeArtifact.type === 'svg') {
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0B0D13; padding: 2rem; }
    svg { max-width: 100%; height: auto; filter: drop-shadow(0 20px 30px rgba(0,0,0,0.5)); }
  </style>
</head>
<body>
  ${activeArtifact.code}
</body>
</html>`;
    }

    // Mode 2: React / JSX Compilation with Babel & UMD Polyfills
    if (activeArtifact.type === 'react') {
      let processedCode = activeArtifact.code
        .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '')
        .replace(/export\s+default\s+([a-zA-Z0-9_$]+);?/g, 'window.__MainComponent = $1;')
        .replace(/export\s+default\s+/g, 'window.__MainComponent = ');

      const compMatch = processedCode.match(/(?:function|const|class)\s+([A-Z][a-zA-Z0-9_$]*)/g);
      const lastComponent = compMatch ? compMatch[compMatch.length - 1].replace(/(?:function|const|class)\s+/, '') : 'App';

      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; margin: 0; background: #0B0D13; color: #f3f4f6; }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useMemo, useCallback } = React;

    try {
      ${processedCode}

      const TargetComponent = window.__MainComponent || (typeof ${lastComponent} !== 'undefined' ? ${lastComponent} : null);
      if (TargetComponent) {
        ReactDOM.createRoot(document.getElementById('root')).render(<TargetComponent />);
      } else {
        document.getElementById('root').innerHTML = '<div class="p-6 text-amber-300 font-bold">Component loaded successfully.</div>';
      }
    } catch (err) {
      console.error(err);
      document.getElementById('root').innerHTML = \`
        <div class="p-6 bg-red-950/80 border border-red-500/50 rounded-2xl m-4 text-red-200">
          <h3 class="font-bold text-base mb-2">React Render Info</h3>
          <p class="text-xs font-mono text-red-300">\${err.message}</p>
        </div>
      \`;
    }
  </script>
</body>
</html>`;
    }

    // Mode 3: Standard Complete HTML App or CSS demo
    if (activeArtifact.type === 'html' || activeArtifact.type === 'code') {
      let code = activeArtifact.code;

      // If it's purely CSS rules, wrap it in a beautiful container with sample cards
      if (!code.includes('<') && (code.includes('{') && code.includes('}'))) {
        code = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 2rem; background: #0B0D13; color: #f3f4f6; font-family: sans-serif; }
    ${code}
  </style>
</head>
<body>
  <div class="max-w-4xl mx-auto space-y-6">
    <div class="p-6 bg-[#161926] rounded-2xl border border-white/10 shadow-xl">
      <h2 class="text-xl font-bold text-amber-400 mb-2">CSS Rules Applied Live</h2>
      <p class="text-sm text-gray-400">The generated CSS rules are injected and active.</p>
    </div>
    <div class="charts-grid">
      <div class="chart-placeholder">Chart Slot 1</div>
      <div class="chart-placeholder">Chart Slot 2</div>
    </div>
  </div>
</body>
</html>`;
        return code;
      }

      if (!code.includes('cdn.tailwindcss.com')) {
        const headInject = `<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  body { font-family: 'Inter', sans-serif; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
</style>`;

        if (code.includes('<head>')) {
          code = code.replace('<head>', `<head>\n${headInject}`);
        } else if (code.includes('<html>')) {
          code = code.replace('<html>', `<html>\n<head>${headInject}</head>`);
        } else {
          code = `<!DOCTYPE html><html><head>${headInject}</head><body>${code}</body></html>`;
        }
      }
      return code;
    }

    return '';
  }, [activeArtifact, sandboxKey]);

  const handleCreateNewSession = () => {
    const newSession = {
      id: 'session_' + Date.now(),
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now()
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setActiveArtifact(null);
    setIsArtifactOpen(false);
    if (textareaRef.current) textareaRef.current.focus();
  };

  const handleDeleteSession = (id, e) => {
    e.stopPropagation();
    if (sessions.length === 1) {
      setSessions([{ id: 'default', title: 'New Conversation', messages: [], createdAt: Date.now() }]);
      setActiveSessionId('default');
      setActiveArtifact(null);
      return;
    }
    const filtered = sessions.filter(s => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
    toast.success('Conversation deleted');
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    files.forEach(file => {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File ${file.name} is too large (> 25MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = event.target.result.split(',')[1];
        setAttachments(prev => [
          ...prev,
          {
            name: file.name,
            type: file.type,
            size: (file.size / 1024).toFixed(1) + ' KB',
            preview: file.type.startsWith('image/') ? event.target.result : null,
            base64: base64Data
          }
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeAttachment = (index) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleSendMessage = async (textToSend) => {
    const messageContent = typeof textToSend === 'string' ? textToSend : inputMessage;
    if (!messageContent.trim() && attachments.length === 0) return;
    if (isLoading) return;

    let contentParts = [];
    if (attachments.length > 0) {
      attachments.forEach(att => {
        if (att.type.startsWith('image/')) {
          contentParts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: att.type,
              data: att.base64
            }
          });
        } else {
          contentParts.push({
            type: 'text',
            text: `[Attached Document: ${att.name} (${att.type})]\n`
          });
        }
      });
    }

    if (messageContent.trim()) {
      contentParts.push({
        type: 'text',
        text: messageContent.trim()
      });
    }

    const newUserMessage = {
      role: 'user',
      content: contentParts.length === 1 && contentParts[0].type === 'text' ? contentParts[0].text : contentParts,
      displayText: messageContent.trim(),
      attachments: [...attachments],
      timestamp: Date.now()
    };

    const updatedMessages = [...activeSession.messages, newUserMessage];
    const sessionTitle = activeSession.messages.length === 0 
      ? (messageContent.slice(0, 32) + (messageContent.length > 32 ? '...' : '')) 
      : activeSession.title;

    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      title: sessionTitle,
      messages: updatedMessages
    } : s));

    setInputMessage('');
    setAttachments([]);
    setIsLoading(true);

    try {
      const apiMessages = updatedMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await api.post('/claude/chat', {
        messages: apiMessages,
        systemPrompt,
        model: selectedModel,
        temperature,
        maxTokens,
        region,
        anthropicApiKey: anthropicApiKey.trim(),
        generateImage: isImageMode,
        imageOptions: {
          aspectRatio: imageAspectRatio,
          style: imageStyle
        }
      });

      if (res.data && res.data.success) {
        const rawResponseText = res.data.text;
        const assistantMessage = {
          role: 'assistant',
          content: rawResponseText,
          displayText: rawResponseText,
          model: res.data.model,
          provider: res.data.provider,
          notice: res.data.notice,
          usage: res.data.usage,
          images: res.data.images || [],
          timestamp: Date.now()
        };

        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          messages: [...updatedMessages, assistantMessage]
        } : s));

        // Auto-detect artifact or image and open live canvas immediately
        const detectedArtifact = extractArtifactFromText(rawResponseText);
        if (detectedArtifact) {
          setActiveArtifact(detectedArtifact);
          setIsArtifactOpen(true);
          setArtifactTab('preview');
          setSandboxKey(prev => prev + 1);
          toast.success('Live Artifact Rendered in Canvas 🎨', { duration: 4000 });
        } else if (res.data.images && res.data.images.length > 0) {
          const img = res.data.images[0];
          setActiveArtifact({
            type: 'image',
            code: img.imageUrl,
            title: img.caption || 'Claude AI Image Studio'
          });
          setIsArtifactOpen(true);
          setArtifactTab('preview');
          setSandboxKey(prev => prev + 1);
          toast.success('AI Image Loaded in Canvas 🎨', { duration: 4000 });
        }

        if (res.data.notice) {
          toast(res.data.notice, { icon: 'ℹ️', duration: 6000 });
        }
      } else {
        throw new Error(res.data?.error || 'No response from Claude');
      }

    } catch (err) {
      console.error('Claude Request Error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'Failed to communicate with Claude Opus 5';
      toast.error(errorMsg);

      const errorAssistantMessage = {
        role: 'assistant',
        content: `⚠️ **Error:** ${errorMsg}\n\n*Please check API settings or Vertex AI credentials.*`,
        displayText: errorMsg,
        isError: true,
        timestamp: Date.now()
      };

      setSessions(prev => prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: [...updatedMessages, errorAssistantMessage]
      } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const downloadArtifactFile = () => {
    if (!activeArtifact) return;
    if (activeArtifact.type === 'image') {
      const a = document.createElement('a');
      a.href = activeArtifact.code;
      a.download = `claude-image-${Date.now()}.jpg`;
      a.target = '_blank';
      a.click();
      toast.success('Downloaded image!');
      return;
    }
    const extension = activeArtifact.type === 'svg' ? 'svg' : activeArtifact.type === 'html' ? 'html' : 'jsx';
    const blob = new Blob([activeArtifact.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `artifact-${Date.now()}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded artifact as .${extension}`);
  };

  const openInNewTab = () => {
    if (!activeArtifact) return;
    const blob = new Blob([compiledIframeDoc || activeArtifact.code], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  };

  // Function to manually launch Canvas for any snippet or last message
  const handleOpenCanvas = () => {
    if (!activeArtifact) {
      const lastAssistantMsg = [...activeSession.messages].reverse().find(m => m.role === 'assistant');
      const found = extractArtifactFromText(lastAssistantMsg?.displayText || lastAssistantMsg?.content || '');
      if (found) {
        setActiveArtifact(found);
      } else {
        setActiveArtifact({
          type: 'html',
          code: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-white min-h-screen flex items-center justify-center p-6">
  <div class="text-center p-8 bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl max-w-lg">
    <div class="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
      <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"></path></svg>
    </div>
    <h2 class="text-2xl font-black text-white mb-2">Live Canvas Studio</h2>
    <p class="text-sm text-gray-400 mb-6">Ask Claude Opus 5 to build a website, dashboard, or game, or click "Run in Canvas" on any code block.</p>
    <button onclick="alert('Canvas is Live!')" class="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl font-bold text-sm text-white shadow-lg shadow-orange-500/30 hover:opacity-90">Test Button</button>
  </div>
</body>
</html>`,
          title: 'Live Canvas Studio'
        });
      }
    }
    setIsArtifactOpen(!isArtifactOpen);
  };

  const filteredSessions = sessions.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-[#090B10] text-gray-100 font-sans overflow-hidden select-none">
      
      {/* ================= LEFT SIDEBAR (CONVERSATION HISTORY) ================= */}
      <div className="w-64 md:w-72 bg-[#0F1118] border-r border-white/10 flex flex-col shrink-0">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/25">
              <Sparkles size={18} className="text-white animate-pulse" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm text-white tracking-wide flex items-center gap-1.5">
                Claude Studio <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono border border-amber-500/30">Opus 5</span>
              </h1>
              <p className="text-[11px] text-gray-400">Live Code Canvas & AI</p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Studio Settings"
          >
            <Settings size={18} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="p-3">
          <button
            onClick={handleCreateNewSession}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold text-sm shadow-lg shadow-orange-600/25 transition-all active:scale-95"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search Chats */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white/5 border border-white/10 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          {filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer text-xs transition-all ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-200 border border-amber-500/30 font-medium shadow-sm'
                    : 'text-gray-400 hover:bg-white/5 hover:text-gray-200 border border-transparent'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <Bot size={15} className={isActive ? 'text-amber-400' : 'text-gray-500'} />
                  <span className="truncate">{session.title || 'Untitled Chat'}</span>
                </div>

                <button
                  onClick={(e) => handleDeleteSession(session.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
                  title="Delete chat"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Status Footer */}
        <div className="p-3 border-t border-white/10 bg-black/30 text-[11px] text-gray-400 flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${serverStatus?.hasGcpAuth ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
            <span className="font-mono text-gray-300">GCP Connected</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-amber-300 font-mono">1M Context</span>
        </div>
      </div>

      {/* ================= WORKSPACE ARENA (CHAT + ARTIFACT SPLIT PANE) ================= */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* LEFT COLUMN: CHAT STREAM */}
        <div className={`flex flex-col bg-[#0C0E15] transition-all duration-300 border-r border-white/10 ${
          isArtifactOpen ? 'w-full lg:w-1/2' : 'w-full'
        }`}>
          
          {/* Top Chat Bar */}
          <div className="h-14 border-b border-white/10 px-5 flex items-center justify-between bg-[#111420]/90 backdrop-blur-md z-10 shrink-0">
            
            {/* Model Selector Dropdown */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="appearance-none bg-white/5 hover:bg-white/10 border border-white/15 rounded-xl px-3.5 py-1.5 pr-8 text-xs font-bold text-gray-100 cursor-pointer focus:outline-none focus:border-amber-500/50 transition-all"
                >
                  {AVAILABLE_MODELS.map(m => (
                    <option key={m.id} value={m.id} className="bg-[#181B26] text-white">
                      {m.name} ({m.badge})
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-2.5 text-gray-400 pointer-events-none" />
              </div>

              {/* Always Visible Live Canvas Toggle Button */}
              <button
                onClick={handleOpenCanvas}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isArtifactOpen 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                    : 'bg-white/10 hover:bg-white/15 text-gray-200 border border-white/15'
                }`}
              >
                <Layers size={14} className={isArtifactOpen ? 'text-amber-400' : 'text-gray-400'} />
                <span>{isArtifactOpen ? 'Close Canvas' : 'Live Canvas 🎨'}</span>
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  if (window.confirm('Clear messages in this conversation?')) {
                    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [] } : s));
                    setActiveArtifact(null);
                    setIsArtifactOpen(false);
                    toast.success('Chat cleared');
                  }
                }}
                disabled={activeSession.messages.length === 0}
                className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                title="Clear Messages"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 custom-scrollbar">
            {activeSession.messages.length === 0 ? (
              
              // Welcome Screen
              <div className="max-w-2xl mx-auto py-8 px-2 flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-2xl shadow-orange-500/30 mb-4 transform hover:scale-105 transition-transform">
                  <Sparkles size={28} className="text-white" />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight mb-2">
                  Claude Opus 5 Live Canvas
                </h2>
                <p className="text-xs md:text-sm text-gray-400 max-w-lg mb-6 leading-relaxed">
                  Generate complete interactive web applications, games, dashboards, and vector graphics that instantly render right beside your conversation.
                </p>

                {/* Template Prompt Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full text-left">
                  {PROMPT_TEMPLATES.map((tmpl, idx) => {
                    const Icon = tmpl.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(tmpl.prompt)}
                        className={`p-3.5 rounded-2xl bg-gradient-to-br ${tmpl.color} bg-opacity-10 border hover:border-white/30 hover:bg-opacity-20 transition-all transform hover:-translate-y-0.5 active:scale-[0.98] group`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center space-x-2">
                            <Icon size={16} />
                            <span className="font-bold text-xs text-white">{tmpl.title}</span>
                          </div>
                          <ArrowUpRight size={14} className="text-gray-400 group-hover:text-white transition-colors" />
                        </div>
                        <p className="text-[11px] text-gray-300 line-clamp-2 leading-relaxed">
                          {tmpl.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

            ) : (

              // Message Feed
              <div className="space-y-6">
                {activeSession.messages.map((msg, index) => {
                  const isUser = msg.role === 'user';

                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      {/* Avatar */}
                      <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                        isUser
                          ? 'bg-blue-600 text-white'
                          : 'bg-gradient-to-tr from-amber-600 to-orange-500 text-white'
                      }`}>
                        {isUser ? <span className="text-[10px] font-bold">ME</span> : <Sparkles size={14} />}
                      </div>

                      {/* Bubble */}
                      <div className={`max-w-[90%] rounded-2xl p-4 text-xs md:text-sm leading-relaxed ${
                        isUser
                          ? 'bg-blue-600/20 border border-blue-500/30 text-white rounded-tr-none'
                          : msg.isError
                            ? 'bg-red-500/10 border border-red-500/30 text-red-200 rounded-tl-none'
                            : 'bg-[#141722] border border-white/10 text-gray-200 rounded-tl-none shadow-xl'
                      }`}>
                        
                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {msg.attachments.map((att, aIdx) => (
                              <div key={aIdx} className="flex items-center gap-2 p-1 bg-black/40 rounded-lg border border-white/10 text-xs">
                                {att.preview ? (
                                  <img src={att.preview} alt={att.name} className="w-8 h-8 object-cover rounded" />
                                ) : (
                                  <Paperclip size={12} className="text-gray-400" />
                                )}
                                <span className="truncate max-w-[120px] font-mono text-[10px] text-gray-300">{att.name}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Text / Markdown with Custom Code Renderer for "Run in Canvas" */}
                        <div className="prose prose-invert max-w-none text-xs md:text-sm prose-p:leading-relaxed">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              code({ node, inline, className, children, ...props }) {
                                const match = /language-(\w+)/.exec(className || '');
                                const lang = match ? match[1] : '';
                                const codeString = String(children).replace(/\n$/, '');

                                if (!inline && (codeString.includes('\n') || codeString.length > 30)) {
                                  return (
                                    <div className="my-3 rounded-2xl overflow-hidden border border-white/15 bg-[#090B10] shadow-xl not-prose">
                                      <div className="flex items-center justify-between px-3.5 py-2 bg-[#121520] border-b border-white/10 text-xs text-gray-400">
                                        <span className="font-mono text-amber-300 font-bold uppercase text-[11px] flex items-center gap-1.5">
                                          <Code size={13} />
                                          {lang || 'code'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const artifactType = (lang === 'html' || lang === 'htm' || codeString.includes('<')) 
                                                ? 'html' 
                                                : (lang === 'svg' ? 'svg' : (codeString.includes('className=') || codeString.includes('import ') ? 'react' : 'code'));
                                              
                                              setActiveArtifact({
                                                type: artifactType,
                                                code: codeString,
                                                title: `${(lang || 'Live').toUpperCase()} Artifact`
                                              });
                                              setIsArtifactOpen(true);
                                              setArtifactTab('preview');
                                              setSandboxKey(k => k + 1);
                                              toast.success('Loaded in Live Canvas 🎨');
                                            }}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-[11px] shadow-sm transition-all active:scale-95 cursor-pointer"
                                          >
                                            <Play size={11} />
                                            <span>Run in Canvas 🎨</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(codeString);
                                              toast.success('Code copied!');
                                            }}
                                            className="p-1 hover:text-white transition-colors cursor-pointer"
                                            title="Copy Code"
                                          >
                                            <Copy size={13} />
                                          </button>
                                        </div>
                                      </div>
                                      <pre className="p-3.5 overflow-x-auto text-xs font-mono text-gray-200 leading-relaxed custom-scrollbar bg-[#090B10]">
                                        <code>{children}</code>
                                      </pre>
                                    </div>
                                  );
                                }
                                return <code className="bg-white/10 px-1 py-0.5 rounded text-amber-300 font-mono text-xs" {...props}>{children}</code>;
                              },
                              img({ node, src, alt, ...props }) {
                                const resolvedSrc = resolveStudioImageUrl(src);
                                return (
                                  <div className="my-4 rounded-2xl overflow-hidden border border-white/15 bg-[#090B10] shadow-2xl not-prose">
                                    <div className="relative overflow-hidden bg-black/60 flex items-center justify-center p-1 min-h-[160px]">
                                      <img
                                        src={resolvedSrc}
                                        alt={alt || 'AI Generated Image'}
                                        onError={(e) => {
                                          const fname = (src || '').split('/').pop();
                                          if (fname && !e.target.dataset.tried) {
                                            e.target.dataset.tried = 'true';
                                            e.target.src = `/uploads/social-media/generated-images/${fname}`;
                                          }
                                        }}
                                        className="w-full max-h-[480px] object-contain rounded-xl transition-all duration-300 hover:scale-[1.01]"
                                      />
                                      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-[11px] font-bold text-amber-300 shadow-lg">
                                        <Sparkles size={12} className="text-amber-400 animate-pulse" />
                                        <span>Claude AI Visual</span>
                                      </div>
                                    </div>
                                    <div className="px-3.5 py-2.5 bg-[#121520] border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                                      <span className="text-xs text-gray-300 font-medium truncate max-w-[200px] sm:max-w-xs">
                                        {alt && alt !== 'AI Generated Image' ? alt : 'AI Generated Visual'}
                                      </span>
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveArtifact({
                                              type: 'image',
                                              code: resolvedSrc,
                                              title: alt || 'Claude AI Image Studio'
                                            });
                                            setIsArtifactOpen(true);
                                            setArtifactTab('preview');
                                            setSandboxKey(k => k + 1);
                                            toast.success('Loaded in Canvas Studio 🎨');
                                          }}
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-[11px] shadow-sm transition-all active:scale-95 cursor-pointer"
                                        >
                                          <Play size={11} />
                                          <span>Open in Canvas 🎨</span>
                                        </button>
                                        <a
                                          href={resolvedSrc}
                                          download={`claude-opus-art-${Date.now()}.jpg`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-200 text-[11px] font-medium transition-all"
                                          title="Download Image"
                                        >
                                          <Download size={12} />
                                          <span>Download</span>
                                        </a>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(window.location.origin + src);
                                            toast.success('Image link copied!');
                                          }}
                                          className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                                          title="Copy Link"
                                        >
                                          <Copy size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                            }}
                          >
                            {msg.displayText || (typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content))}
                          </ReactMarkdown>
                        </div>

                        {/* Footer */}
                        {!isUser && !msg.isError && (
                          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between text-[10px] text-gray-400">
                            <span className="font-mono text-amber-300/80">{msg.model || selectedModel}</span>
                            <button
                              onClick={() => copyToClipboard(msg.displayText || msg.content, index)}
                              className="flex items-center gap-1 hover:text-white transition-colors"
                            >
                              {copiedIndex === index ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={11} />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                      </div>
                    </div>
                  );
                })}

                {/* Loading State */}
                {isLoading && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center shrink-0 shadow-md animate-pulse">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <div className="bg-[#141722] border border-white/10 rounded-2xl rounded-tl-none p-3.5 shadow-xl flex items-center gap-3 text-xs text-amber-300">
                      <RefreshCw size={14} className="animate-spin text-amber-400" />
                      <span>Claude Opus 5 is synthesizing code & reasoning...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Bar */}
          <div className="p-3.5 md:p-4 bg-[#10131E]/95 border-t border-white/10 backdrop-blur-md shrink-0">
            <div className="max-w-3xl mx-auto">
              
              {/* Attachment Preview Chips */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2.5">
                  {attachments.map((att, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-200">
                      {att.preview ? (
                        <img src={att.preview} alt={att.name} className="w-5 h-5 object-cover rounded" />
                      ) : (
                        <Paperclip size={12} />
                      )}
                      <span className="font-mono text-[11px] truncate max-w-[120px]">{att.name}</span>
                      <button onClick={() => removeAttachment(idx)} className="text-gray-400 hover:text-red-400">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Image Generation Mode Options Drawer */}
              {isImageMode && (
                <div className="mb-2.5 p-2.5 bg-[#141824] border border-amber-500/30 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-lg animate-in fade-in duration-200">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 font-bold text-[11px] flex items-center gap-1">
                      <Sparkles size={11} className="text-amber-400 animate-pulse" />
                      AI Image Mode Active
                    </span>

                    {/* Aspect Ratio Selector */}
                    <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-[11px]">
                      {[
                        { id: '1:1', label: '1:1 Square' },
                        { id: '16:9', label: '16:9 Banner' },
                        { id: '9:16', label: '9:16 Story' }
                      ].map(r => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setImageAspectRatio(r.id)}
                          className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                            imageAspectRatio === r.id ? 'bg-amber-600 text-white font-bold' : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>

                    {/* Style Preset Selector */}
                    <select
                      value={imageStyle}
                      onChange={(e) => setImageStyle(e.target.value)}
                      className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-amber-200 focus:outline-none focus:border-amber-500/50 cursor-pointer"
                    >
                      <option value="photorealistic">Photorealistic</option>
                      <option value="cinematic">Cinematic</option>
                      <option value="3d-render">3D Render</option>
                      <option value="marketing-poster">Marketing Poster</option>
                      <option value="anime">Anime</option>
                      <option value="cyberpunk">Cyberpunk</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsImageMode(false)}
                    className="text-gray-400 hover:text-red-400 p-1 transition-colors"
                    title="Disable AI Image Mode"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}

              {/* Text Input Box */}
              <div className={`relative rounded-2xl bg-[#161926] border shadow-xl transition-all ${
                isImageMode ? 'border-amber-500/50 shadow-amber-500/10' : 'border-white/15 focus-within:border-amber-500/50'
              }`}>
                
                <textarea
                  ref={textareaRef}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isImageMode
                      ? "Describe the AI image you want Claude Opus 5 to generate... (Sinhala / English)"
                      : "Ask Claude Opus 5 to build UI, generate AI images, write code, or solve problems... (Shift+Enter for newline)"
                  }
                  rows={2}
                  className="w-full bg-transparent px-3.5 py-3 pr-28 text-xs md:text-sm text-gray-100 placeholder-gray-500 focus:outline-none resize-none custom-scrollbar"
                />

                <div className="absolute right-2.5 bottom-2.5 flex items-center space-x-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    accept="image/*,.pdf,.txt,.json,.csv"
                    className="hidden"
                  />

                  {/* AI Image Generation Mode Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsImageMode(!isImageMode);
                      if (!isImageMode) {
                        toast('🎨 AI Image Mode enabled! Describe any image you want.', { icon: '✨', duration: 3000 });
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      isImageMode
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/30'
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={isImageMode ? 'AI Image Mode: ON' : 'Toggle AI Image Generation Mode'}
                  >
                    <ImageIcon size={16} className={isImageMode ? 'text-amber-400 animate-pulse' : ''} />
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                    title="Attach Image / Document"
                  >
                    <Paperclip size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || (!inputMessage.trim() && attachments.length === 0)}
                    className="p-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-orange-600/30 transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                    title="Send"
                  >
                    {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: CLAUDE LIVE ARTIFACTS CANVAS STUDIO */}
        {isArtifactOpen && (
          <div className={`flex flex-col bg-[#07090E] transition-all duration-300 ${
            isFullScreenArtifact 
              ? 'fixed inset-0 z-50 bg-[#07090E]' 
              : 'w-full lg:w-1/2'
          }`}>
            
            {/* Artifact Canvas Header */}
            <div className="h-14 border-b border-white/10 px-4 flex items-center justify-between bg-[#0F121C] shrink-0">
              
              <div className="flex items-center space-x-2">
                <div className="flex bg-black/40 p-0.5 rounded-xl border border-white/10">
                  <button
                    onClick={() => setArtifactTab('preview')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      artifactTab === 'preview'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Eye size={13} />
                    <span>Live Preview</span>
                  </button>

                  <button
                    onClick={() => setArtifactTab('code')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      artifactTab === 'code'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    <Code size={13} />
                    <span>Code Editor</span>
                  </button>
                </div>

                {/* Viewport controls (Only in Preview tab) */}
                {artifactTab === 'preview' && (
                  <div className="hidden sm:flex items-center bg-black/40 p-0.5 rounded-xl border border-white/10 ml-2">
                    <button
                      onClick={() => setViewportMode('desktop')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewportMode === 'desktop' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Desktop (100%)"
                    >
                      <Monitor size={14} />
                    </button>
                    <button
                      onClick={() => setViewportMode('tablet')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewportMode === 'tablet' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Tablet (768px)"
                    >
                      <Tablet size={14} />
                    </button>
                    <button
                      onClick={() => setViewportMode('mobile')}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewportMode === 'mobile' ? 'bg-white/20 text-white' : 'text-gray-400 hover:text-white'}`}
                      title="Mobile (390px)"
                    >
                      <Smartphone size={14} />
                    </button>
                  </div>
                )}
              </div>

              {/* Artifact Toolbar */}
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => setSandboxKey(k => k + 1)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Rerun Sandbox"
                >
                  <RefreshCw size={15} />
                </button>

                <button
                  onClick={openInNewTab}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Open in New Tab"
                >
                  <ExternalLink size={15} />
                </button>

                <button
                  onClick={downloadArtifactFile}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Download File"
                >
                  <Download size={15} />
                </button>

                <button
                  onClick={() => setIsFullScreenArtifact(!isFullScreenArtifact)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title={isFullScreenArtifact ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {isFullScreenArtifact ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                <button
                  onClick={() => setIsArtifactOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Close Canvas"
                >
                  <PanelRightClose size={16} />
                </button>
              </div>

            </div>

            {/* Artifact Content Body */}
            <div className="flex-1 overflow-hidden relative flex items-center justify-center p-4 bg-[#05070B]">
              
              {artifactTab === 'preview' ? (
                
                // Live Rendered Viewport Sandbox
                <div
                  className={`h-full transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0B0D13] ${
                    viewportMode === 'mobile'
                      ? 'w-[390px] max-w-full'
                      : viewportMode === 'tablet'
                        ? 'w-[768px] max-w-full'
                        : 'w-full'
                  }`}
                >
                  <iframe
                    key={sandboxKey}
                    title="Live Artifact Sandbox"
                    srcDoc={compiledIframeDoc}
                    sandbox="allow-scripts allow-modals allow-popups"
                    className="w-full h-full border-0 bg-[#0B0D13]"
                  />
                </div>

              ) : (

                // Interactive Code Editor / View
                <div className="w-full h-full bg-[#0D1017] rounded-2xl border border-white/10 p-4 flex flex-col font-mono text-xs text-gray-200">
                  <div className="flex justify-between items-center pb-3 mb-3 border-b border-white/10 shrink-0">
                    <span className="text-amber-300 font-bold">{activeArtifact?.title || 'Code Editor'}</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setSandboxKey(k => k + 1);
                          setArtifactTab('preview');
                          toast.success('Preview refreshed with edited code!');
                        }}
                        className="flex items-center space-x-1 px-3 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-sans font-bold transition-colors cursor-pointer"
                      >
                        <Play size={12} />
                        <span>Run Code</span>
                      </button>
                      <button
                        onClick={() => {
                          if (activeArtifact?.code) {
                            navigator.clipboard.writeText(activeArtifact.code);
                            toast.success('Artifact code copied!');
                          }
                        }}
                        className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-sans transition-colors cursor-pointer"
                      >
                        <Copy size={12} />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={activeArtifact?.code || ''}
                    onChange={(e) => setActiveArtifact(prev => ({ ...prev, code: e.target.value }))}
                    className="flex-1 w-full bg-transparent resize-none text-xs font-mono text-gray-200 focus:outline-none custom-scrollbar leading-relaxed"
                    placeholder="Paste or edit HTML/JS/CSS code here..."
                  />
                </div>

              )}

            </div>

          </div>
        )}

      </div>

      {/* ================= CONFIGURATION / SETTINGS MODAL ================= */}
      {showSettings && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#161926] border border-white/15 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Settings size={18} className="text-amber-400" />
                <h3 className="font-bold text-base text-white">Claude Studio Settings</h3>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
              
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Google Cloud Region (Vertex AI)
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-[#10131E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 focus:outline-none focus:border-amber-500/50"
                >
                  <option value="us-east5">us-east5 (Recommended for Claude Opus)</option>
                  <option value="us-central1">us-central1 (Iowa)</option>
                  <option value="europe-west1">europe-west1 (Belgium)</option>
                  <option value="global">global</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Direct Anthropic API Key (Optional)
                </label>
                <input
                  type="password"
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                  placeholder="sk-ant-api03-..."
                  className="w-full bg-[#10131E] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-gray-100 font-mono focus:outline-none focus:border-amber-500/50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  System Persona & Instructions
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={4}
                  className="w-full bg-[#10131E] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-100 focus:outline-none focus:border-amber-500/50 resize-none"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  <span>Temperature (Creativity)</span>
                  <span className="font-mono text-amber-400">{temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  <span>Max Output Tokens</span>
                  <span className="font-mono text-amber-400">{maxTokens}</span>
                </div>
                <input
                  type="range"
                  min="1024"
                  max="8192"
                  step="512"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

            </div>

            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
              <button
                onClick={() => {
                  setShowSettings(false);
                  toast.success('Settings saved!');
                }}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm transition-all"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

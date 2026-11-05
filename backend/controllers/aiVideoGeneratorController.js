const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ensure required upload folders exist
const UPLOADS_BASE = path.join(__dirname, '../public/uploads/social-media');
const RENDERS_DIR = path.join(UPLOADS_BASE, 'renders');
const STOCK_DIR = path.join(UPLOADS_BASE, 'stock');
const BGM_DIR = path.join(UPLOADS_BASE, 'bgm');
const AUDIO_DIR = path.join(UPLOADS_BASE, 'audio');

[UPLOADS_BASE, RENDERS_DIR, STOCK_DIR, BGM_DIR, AUDIO_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Curated Real High-Definition (1080p) Royalty-Free Stock Videos
const CURATED_STOCK_VIDEOS = [
    {
        id: 'stock-campus-1',
        title: 'University Students Walking to Class Together',
        category: 'Campus & Education',
        keywords: ['campus', 'university', 'students', 'college', 'education', 'hallway', 'entrance', 'walk', 'friends'],
        videoUrl: '/uploads/social-media/stock/real_students_campus.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=600&auto=format&fit=crop&q=60',
        duration: 15
    },
    {
        id: 'stock-study-1',
        title: 'Focused Student Studying with Laptop and Tablet',
        category: 'Campus & Education',
        keywords: ['study', 'studying', 'library', 'laptop', 'learn', 'books', 'student', 'exam', 'mind', 'focus', 'read', 'class'],
        videoUrl: '/uploads/social-media/stock/real_student_studying.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=600&auto=format&fit=crop&q=60',
        duration: 15
    },
    {
        id: 'stock-notes-1',
        title: 'Student Taking Notes in Classroom Lecture',
        category: 'Campus & Education',
        keywords: ['notes', 'lecture', 'classroom', 'teacher', 'lesson', 'write', 'learning', 'grade', 'education', 'school'],
        videoUrl: '/uploads/social-media/stock/stock_coverr-female-student-taking-notes-1637.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=600&auto=format&fit=crop&q=60',
        duration: 15
    },
    {
        id: 'stock-coding-1',
        title: 'Software Developer Coding Sequences on Computer',
        category: 'Technology & IT',
        keywords: ['tech', 'technology', 'code', 'coding', 'software', 'computer', 'programming', 'developer', 'ai', 'matrix', 'digital', 'screen'],
        videoUrl: '/uploads/social-media/stock/stock_coding.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=60',
        duration: 15
    },
    {
        id: 'stock-team-1',
        title: 'Team Collaboration & Group Planning',
        category: 'Business & Finance',
        keywords: ['business', 'finance', 'accounting', 'growth', 'money', 'team', 'corporate', 'success', 'work', 'meeting', 'office', 'plan'],
        videoUrl: '/uploads/social-media/stock/stock_teamwork.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=60',
        duration: 15
    },
    {
        id: 'stock-smartphone-1',
        title: 'Smartphone Search, Research & Social Media',
        category: 'Marketing & Tech',
        keywords: ['smartphone', 'mobile', 'online', 'search', 'click', 'register', 'join', 'call', 'contact', 'secret', 'mystery', 'truth', 'cia', 'gateway', 'hologram', 'universe', 'brain', 'consciousness'],
        videoUrl: '/uploads/social-media/stock/stock_smartphone.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&auto=format&fit=crop&q=60',
        duration: 15
    },
    {
        id: 'stock-desk-1',
        title: 'Productive Desk Study & Workspace Focus',
        category: 'Campus & Education',
        keywords: ['desk', 'office', 'study', 'laptop', 'focus', 'achievement', 'result', 'motivation', 'exam'],
        videoUrl: '/uploads/social-media/stock/stock_desk_study.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&auto=format&fit=crop&q=60',
        duration: 15
    },
    {
        id: 'stock-tablet-1',
        title: 'Digital Learning Outdoors with Tablet',
        category: 'Technology & IT',
        keywords: ['tablet', 'digital', 'nature', 'connect', 'future', 'skills', 'learn', 'online'],
        videoUrl: '/uploads/social-media/stock/stock_tablet_tech.mp4',
        thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=60',
        duration: 15
    }
];

// Royalty-Free Background Music Tracks (Local Fast MP3s)
const BGM_TRACKS = [
    {
        id: 'bgm-inspiring-future',
        name: 'Inspiring Education Future',
        genre: 'Cinematic / Uplifting',
        audioUrl: '/uploads/social-media/bgm/bgm_inspiring_future.mp3',
        duration: 60
    },
    {
        id: 'bgm-energetic-tech',
        name: 'Energetic Tech Pulse',
        genre: 'Modern / Beats',
        audioUrl: '/uploads/social-media/bgm/bgm_energetic_tech.mp3',
        duration: 60
    },
    {
        id: 'bgm-lofi-chill',
        name: 'Lo-Fi Chill Study Beat',
        genre: 'Lo-Fi / Relaxed',
        audioUrl: '/uploads/social-media/bgm/bgm_lofi_chill.mp3',
        duration: 60
    },
    {
        id: 'bgm-corporate-growth',
        name: 'Corporate Growth & Motivation',
        genre: 'Corporate / Motivation',
        audioUrl: '/uploads/social-media/bgm/bgm_corporate_growth.mp3',
        duration: 60
    }
];

// Helper: Download a remote file to a local destination
const downloadFile = async (url, destPath) => {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await axios({
                method: 'GET',
                url: url,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.google.com/'
                },
                timeout: 30000
            });

            const file = fs.createWriteStream(destPath);
            response.data.pipe(file);

            file.on('finish', () => {
                file.close(() => resolve(destPath));
            });

            file.on('error', (err) => {
                fs.unlink(destPath, () => {});
                reject(err);
            });
        } catch (err) {
            reject(err);
        }
    });
};

// Helper: Get audio/video duration using ffprobe
const getMediaDuration = (filePath) => {
    return new Promise((resolve) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return resolve(4.0);
            const duration = metadata?.format?.duration || 4.0;
            resolve(parseFloat(duration));
        });
    });
};

// Helper: Search Coverr / Wikimedia for real video clips
const searchOnlineVideoFootages = async (query) => {
    if (!query || !query.trim()) return [];
    try {
        const cleanWords = query.replace(/[^\w\s]/g, ' ').trim().split(/\s+/);
        const searchWord = cleanWords[0] || 'students';

        const res = await axios.get('https://coverr.co/api/videos?query=' + encodeURIComponent(searchWord) + '&page=1', {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 6000
        });

        const hits = res.data?.hits || [];
        const items = [];

        for (const h of hits.slice(0, 6)) {
            if (h.base_filename) {
                items.push({
                    id: `coverr-${h.id || h.base_filename}`,
                    title: h.title || 'Stock Video Footage',
                    category: 'Online Video Stock',
                    videoUrl: `https://cdn.coverr.co/videos/${h.base_filename}/1080p.mp4`,
                    thumbnail: h.thumbnail || h.poster,
                    isImage: false,
                    duration: 15
                });
            }
        }
        return items;
    } catch (e) {
        return [];
    }
};

// Helper: Find best matching stock footage from curated library or online search
const findMatchingStockFootage = async (keyword, index = 0) => {
    const kw = (keyword || '').toLowerCase();
    
    // 1. Check curated real stock video library
    let match = CURATED_STOCK_VIDEOS.find(v => 
        v.keywords.some(k => kw.includes(k) || k.includes(kw)) ||
        v.title.toLowerCase().includes(kw)
    );

    if (match) return match;

    // 2. Try online Coverr video search
    try {
        const onlineClips = await searchOnlineVideoFootages(keyword);
        if (onlineClips.length > 0) {
            return onlineClips[0];
        }
    } catch (_) {}

    // 3. Fallback to curated library (cycle through rich real videos)
    return CURATED_STOCK_VIDEOS[index % CURATED_STOCK_VIDEOS.length];
};

// Helper: Format ASS time
function formatAssTime(seconds) {
    const sVal = Math.max(0, seconds);
    const h = Math.floor(sVal / 3600);
    const m = Math.floor((sVal % 3600) / 60);
    const s = Math.floor(sVal % 60);
    const cs = Math.floor((sVal % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

// Convert Hex Color (#RRGGBB) to ASS Color (&H00BBGGRR)
function hexToAssColor(hex, defaultVal = '&H00FFFFFF') {
    if (!hex) return defaultVal;
    let clean = hex.replace('#', '');
    if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
    if (clean.length !== 6) return defaultVal;
    const r = clean.substring(0, 2);
    const g = clean.substring(2, 4);
    const b = clean.substring(4, 6);
    return `&H00${b}${g}${r}`;
}

// =========================================================================
// VIRAL WORD-BY-WORD (KARAOKE POP-IN HIGHLIGHT) SUBTITLE BUILDER
// =========================================================================
function buildWordByWordAssEvents(text, startTime, sceneDuration, stylePreset = 'tiktok') {
    const cleanText = (text || '').trim();
    if (!cleanText) return '';

    const words = cleanText.split(/\s+/).filter(w => w.length > 0);
    if (words.length === 0) return '';

    const totalDuration = Math.max(1.5, sceneDuration - 0.2);
    const wordDuration = totalDuration / words.length;

    // Chunk words into punchy 2-4 word cards for mobile reading
    const chunkSize = 3;
    const chunks = [];
    for (let i = 0; i < words.length; i += chunkSize) {
        chunks.push(words.slice(i, i + chunkSize));
    }

    let activeWordColor = '&H0000FFFF'; // Viral Yellow
    let baseWordColor = '&H00FFFFFF';   // Crisp White

    if (stylePreset === 'neon') {
        activeWordColor = '&H00FFFF00'; // Cyan
    } else if (stylePreset === 'gold') {
        activeWordColor = '&H0000D7FF'; // Gold
    } else if (stylePreset === 'clean') {
        activeWordColor = '&H0000E5FF'; // Electric Blue
    }

    let events = '';
    let wordOffset = 0;

    for (let c = 0; c < chunks.length; c++) {
        const chunkWords = chunks[c];
        for (let w = 0; w < chunkWords.length; w++) {
            const wordStart = startTime + ((wordOffset + w) * wordDuration);
            const wordEnd = startTime + ((wordOffset + w + 1) * wordDuration);

            const lineStr = chunkWords.map((cw, idx) => {
                const upperWord = cw.toUpperCase();
                if (idx === w) {
                    // Active Word: Scale up 125% and glow in active accent color
                    return `{\\c${activeWordColor}&\\fscx125\\fscy125}${upperWord}{\\r}`;
                } else {
                    // Inactive Words: crisp white
                    return `{\\c${baseWordColor}&}${upperWord}`;
                }
            }).join(' ');

            events += `Dialogue: 0,${formatAssTime(wordStart)},${formatAssTime(wordEnd)},Default,,0,0,0,,${lineStr}\n`;
        }
        wordOffset += chunkWords.length;
    }

    return events;
}

// =========================================================================
// 1. GENERATE SCRIPT & STORYBOARD WITH GEMINI AI
// =========================================================================
exports.generateStoryboard = async (req, res) => {
    try {
        const {
            script,
            topic,
            platform = 'Reels/Shorts',
            aspectRatio = '9:16',
            targetDuration = 30,
            language = 'si'
        } = req.body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in backend environment.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const sceneCount = Math.max(3, Math.min(8, Math.round(targetDuration / 5)));

        const systemPrompt = `You are a world-class viral social media video creator and storyboard director for IMA Campus (A/L & O/L higher education & professional education institute).
Your task is to take the provided user script (or generate a viral script from the given topic) and break it down into exactly ${sceneCount} punchy, high-retention video scenes.

Language instructions:
- If language is 'si' (Sinhala), write natural, catchy Sinhala spoken text for the scriptText and caption.
- If language is 'en' (English), write modern, engaging English script text.
- If language is 'singlish' (Singlish), write colloquial Singlish/Sinhala in English letters.
- The 'visualKeyword' field MUST ALWAYS BE IN CLEAR ENGLISH to allow automated stock video searching (e.g. "students campus", "coding computer", "library studying", "teamwork office", "mobile technology").

Target Aspect Ratio: ${aspectRatio} (${platform})
Target Total Video Duration: ~${targetDuration} seconds.

Output MUST be a single valid JSON object strictly matching this schema:
{
  "title": "Short Catchy Video Title",
  "hook": "Attention-grabbing opening hook",
  "scenes": [
    {
      "sceneNumber": 1,
      "scriptText": "Exact text that the voiceover will speak in this scene",
      "caption": "Short on-screen bold caption highlight (max 4-6 words)",
      "visualKeyword": "students study campus technology",
      "estimatedDuration": 5
    }
  ]
}
`;

        const userPrompt = script 
            ? `Here is the user script to convert into a ${sceneCount}-scene storyboard:\n"""\n${script}\n"""`
            : `Generate an engaging, viral social media video script and storyboard for the topic:\n"""\n${topic || 'Join IMA Campus for the best A/L and O/L classes'}\n"""`;

        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
            ],
            generationConfig: {
                responseMimeType: 'application/json'
            }
        });

        const rawJson = result.response.text();
        let parsedData = null;
        try {
            let cleanStr = rawJson.trim();
            cleanStr = cleanStr.replace(/```json/gi, '').replace(/```/g, '').trim();
            
            const firstBrace = cleanStr.indexOf('{');
            const lastBrace = cleanStr.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                try {
                    parsedData = JSON.parse(cleanStr.substring(firstBrace, lastBrace + 1));
                } catch (_) {}
            }

            if (!parsedData) {
                const firstBracket = cleanStr.indexOf('[');
                const lastBracket = cleanStr.lastIndexOf(']');
                if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                    const arr = JSON.parse(cleanStr.substring(firstBracket, lastBracket + 1));
                    parsedData = { scenes: arr };
                } else {
                    parsedData = JSON.parse(cleanStr);
                }
            }
        } catch (parseErr) {
            console.error('[AI Video] JSON parse failed, raw output:', rawJson, 'Parse Error:', parseErr.message);
            return res.status(500).json({ error: 'Failed to parse AI storyboard output. Please try again.' });
        }

        // Normalize scenes array
        let rawScenes = [];
        if (Array.isArray(parsedData)) {
            rawScenes = parsedData;
        } else if (Array.isArray(parsedData.scenes)) {
            rawScenes = parsedData.scenes;
        } else if (Array.isArray(parsedData.storyboard)) {
            rawScenes = parsedData.storyboard;
        } else if (Array.isArray(parsedData.shots)) {
            rawScenes = parsedData.shots;
        }

        if (rawScenes.length === 0) {
            const textToSplit = script || topic || 'Welcome to IMA Campus';
            const sentences = textToSplit.split(/[.!?\n]+/).filter(s => s.trim().length > 3);
            rawScenes = sentences.slice(0, 6).map((sent, i) => ({
                sceneNumber: i + 1,
                scriptText: sent.trim(),
                caption: sent.trim().substring(0, 30),
                visualKeyword: 'campus students technology',
                estimatedDuration: 5
            }));
        }

        // Attach matching real stock footage and audio hints to each scene asynchronously
        const enhancedScenes = await Promise.all(rawScenes.map(async (scene, idx) => {
            const matchedFootage = await findMatchingStockFootage(scene.visualKeyword, idx);
            return {
                id: `scene-${idx + 1}`,
                sceneNumber: scene.sceneNumber || (idx + 1),
                scriptText: scene.scriptText || '',
                caption: scene.caption || scene.scriptText || '',
                visualKeyword: scene.visualKeyword || 'students study campus',
                estimatedDuration: scene.estimatedDuration || 5,
                footage: matchedFootage,
                audioUrl: null
            };
        }));

        res.status(200).json({
            title: parsedData.title || 'AI Generated Social Video',
            hook: parsedData.hook || '',
            aspectRatio,
            platform,
            scenes: enhancedScenes
        });

    } catch (error) {
        console.error('[AI Video Generator] Error in generateStoryboard:', error);
        res.status(500).json({ error: error.message || 'Failed to generate storyboard' });
    }
};

// =========================================================================
// 2. SEARCH & FETCH ROYALTY-FREE STOCK FOOTAGES
// =========================================================================
exports.searchStockFootages = async (req, res) => {
    try {
        const { query = '', category = 'All' } = req.body;
        const q = query.toLowerCase().trim();

        // 1. Curated real local stock matches
        let curatedMatches = CURATED_STOCK_VIDEOS.filter(v => {
            const matchesCategory = category === 'All' || v.category === category;
            const matchesQuery = !q || 
                v.title.toLowerCase().includes(q) || 
                v.keywords.some(k => k.includes(q) || q.includes(k)) ||
                v.category.toLowerCase().includes(q);
            return matchesCategory && matchesQuery;
        });

        // 2. Online Coverr real stock matches
        let onlineMatches = [];
        if (q) {
            onlineMatches = await searchOnlineVideoFootages(q);
        }

        const combined = [...curatedMatches, ...onlineMatches];
        const results = combined.length > 0 ? combined : CURATED_STOCK_VIDEOS;

        res.status(200).json({
            query,
            total: results.length,
            footages: results
        });

    } catch (error) {
        console.error('[AI Video Generator] Error in searchStockFootages:', error);
        res.status(500).json({ error: 'Failed to search stock footages' });
    }
};

// =========================================================================
// 3. GENERATE SYNCHRONIZED VOICE AI (TTS)
// =========================================================================
exports.generateTTS = async (req, res) => {
    try {
        const { text, language = 'si', voice = 'default', speed = 1.0 } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Text is required for TTS synthesis.' });
        }

        const cleanText = text.trim();
        const filename = `tts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.mp3`;
        const outputPath = path.join(AUDIO_DIR, filename);

        const langCode = (language === 'si' || language === 'sinhala') ? 'si' : 'en';
        const encodedText = encodeURIComponent(cleanText);
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodedText}`;

        await downloadFile(ttsUrl, outputPath);
        const duration = await getMediaDuration(outputPath);
        const publicUrl = `/uploads/social-media/audio/${filename}`;

        res.status(200).json({
            audioUrl: publicUrl,
            duration: Math.max(1.5, duration),
            filename
        });

    } catch (error) {
        console.error('[AI Video Generator] Error in generateTTS:', error);
        res.status(500).json({ error: 'Failed to generate voice audio' });
    }
};

// =========================================================================
// 4. GET BACKGROUND MUSIC TRACKS
// =========================================================================
exports.getBgmTracks = (req, res) => {
    res.status(200).json({
        tracks: BGM_TRACKS
    });
};

// =========================================================================
// 5. FULL AUTOMATED FFMPEG VIDEO RENDERING PIPELINE
// =========================================================================
exports.renderAIVideo = async (req, res) => {
    const jobId = `render_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const jobDir = path.join(RENDERS_DIR, jobId);

    try {
        const {
            scenes = [],
            aspectRatio = '9:16',
            subtitleStyle = {},
            bgmTrackId = null,
            bgmVolume = 0.12,
            videoTitle = 'IMA_AI_Video'
        } = req.body;

        if (!scenes || scenes.length === 0) {
            return res.status(400).json({ error: 'At least one scene is required to render video.' });
        }

        fs.mkdirSync(jobDir, { recursive: true });
        console.log(`[AI Video Render] Starting Job ${jobId} with ${scenes.length} scenes for aspect ratio ${aspectRatio}...`);

        // Target Dimensions
        let targetWidth = 1080;
        let targetHeight = 1920; // 9:16 vertical reel default
        if (aspectRatio === '16:9') {
            targetWidth = 1920;
            targetHeight = 1080;
        } else if (aspectRatio === '1:1') {
            targetWidth = 1080;
            targetHeight = 1080;
        }

        // Subtitle Style configs (TikTok Viral Style)
        const stylePreset = subtitleStyle.preset || 'tiktok';
        const fontSize = aspectRatio === '9:16' ? 76 : (aspectRatio === '16:9' ? 56 : 52);
        let outlineColor = '&H00000000'; // Black Outline
        let backColor = '&H80000000';    // Shadow box
        let outlineWidth = 8;
        let shadowWidth = 4;

        if (stylePreset === 'neon') {
            outlineColor = '&H00FF00FF'; // Magenta glow
            outlineWidth = 8;
            shadowWidth = 5;
        }

        // Step A: Process Each Scene (Download Real Footage & Audio, Trim, Crop & Re-encode)
        const processedClipPaths = [];
        let accumulatedTime = 0.0;
        let assEvents = '';

        for (let i = 0; i < scenes.length; i++) {
            const scene = scenes[i];
            const sceneIdx = i + 1;
            console.log(`[AI Video Render] Processing Scene ${sceneIdx}/${scenes.length}...`);

            // 1. Audio handling: generate TTS audio if not already provided
            let localAudioPath = path.join(jobDir, `audio_${sceneIdx}.mp3`);
            const langCode = (scene.language === 'si' || scene.language === 'sinhala') ? 'si' : 'en';

            if (scene.audioUrl && typeof scene.audioUrl === 'string') {
                if (scene.audioUrl.startsWith('http')) {
                    await downloadFile(scene.audioUrl, localAudioPath);
                } else {
                    const localRelative = path.join(__dirname, '../public', scene.audioUrl);
                    if (fs.existsSync(localRelative)) {
                        fs.copyFileSync(localRelative, localAudioPath);
                    } else {
                        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(scene.scriptText || 'IMA Campus')}`;
                        await downloadFile(ttsUrl, localAudioPath);
                    }
                }
            } else {
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${langCode}&client=tw-ob&q=${encodeURIComponent(scene.scriptText || 'IMA Campus')}`;
                await downloadFile(ttsUrl, localAudioPath);
            }

            // Determine scene duration from audio or fallback
            const audioDuration = await getMediaDuration(localAudioPath);
            const sceneDuration = Math.max(2.5, audioDuration + 0.4);

            // 2. Real Video Footage handling
            let rawFootagePath = path.join(jobDir, `raw_media_${sceneIdx}`);
            let footageUrl = scene.footage?.videoUrl || (typeof scene.footage === 'string' ? scene.footage : CURATED_STOCK_VIDEOS[i % CURATED_STOCK_VIDEOS.length].videoUrl);
            let isImageMedia = scene.footage?.isImage || /\.(jpg|jpeg|png|webp|gif|avif)($|\?)/i.test(footageUrl);

            if (footageUrl.startsWith('http')) {
                const ext = isImageMedia ? '.jpg' : '.mp4';
                rawFootagePath += ext;
                await downloadFile(footageUrl, rawFootagePath);
            } else {
                const localRelative = path.join(__dirname, '../public', footageUrl);
                if (fs.existsSync(localRelative)) {
                    rawFootagePath += path.extname(localRelative);
                    fs.copyFileSync(localRelative, rawFootagePath);
                    isImageMedia = /\.(jpg|jpeg|png|webp)($|\?)/i.test(localRelative);
                } else {
                    rawFootagePath += '.mp4';
                    const fallbackLocal = path.join(__dirname, '../public', CURATED_STOCK_VIDEOS[i % CURATED_STOCK_VIDEOS.length].videoUrl);
                    fs.copyFileSync(fallbackLocal, rawFootagePath);
                }
            }

            // 3. Process Scene: Real Video Center Crop OR Photo Ken-Burns Motion + Synchronize with Voice Audio
            const sceneOutPath = path.join(jobDir, `processed_scene_${sceneIdx}.mp4`);

            if (isImageMedia) {
                const totalFrames = Math.round(sceneDuration * 30);
                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(rawFootagePath)
                        .loop(sceneDuration)
                        .input(localAudioPath)
                        .complexFilter([
                            `[0:v]scale=8000:-1,zoompan=z='min(zoom+0.0015,1.25)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=${targetWidth}x${targetHeight}:fps=30,format=yuv420p[v]`
                        ])
                        .outputOptions([
                            '-map [v]',
                            '-map 1:a:0',
                            '-c:v libx264',
                            '-preset ultrafast',
                            '-pix_fmt yuv420p',
                            '-c:a aac',
                            '-b:a 192k',
                            '-t', `${sceneDuration}`
                        ])
                        .save(sceneOutPath)
                        .on('end', () => {
                            console.log(`[AI Video Render] Scene ${sceneIdx} (Photo Motion) encoded (${sceneDuration.toFixed(2)}s).`);
                            resolve(sceneOutPath);
                        })
                        .on('error', reject);
                });
            } else {
                const videoFilter = `scale=w=${targetWidth}:h=${targetHeight}:force_original_aspect_ratio=increase,crop=${targetWidth}:${targetHeight},setsar=1,fps=30`;
                await new Promise((resolve, reject) => {
                    ffmpeg()
                        .input(rawFootagePath)
                        .inputOptions(['-stream_loop -1'])
                        .input(localAudioPath)
                        .duration(sceneDuration)
                        .videoFilters(videoFilter)
                        .outputOptions([
                            '-map 0:v:0',
                            '-map 1:a:0',
                            '-c:v libx264',
                            '-preset ultrafast',
                            '-pix_fmt yuv420p',
                            '-c:a aac',
                            '-b:a 192k'
                        ])
                        .save(sceneOutPath)
                        .on('end', () => {
                            console.log(`[AI Video Render] Scene ${sceneIdx} (Real Stock Video) encoded (${sceneDuration.toFixed(2)}s).`);
                            resolve(sceneOutPath);
                        })
                        .on('error', reject);
                });
            }

            processedClipPaths.push(sceneOutPath);

            // 4. Build Synchronized Word-by-Word Subtitle Events for this scene
            const spokenText = scene.scriptText || scene.caption || '';
            const sceneWordEvents = buildWordByWordAssEvents(spokenText, accumulatedTime, sceneDuration, stylePreset);
            assEvents += sceneWordEvents;

            accumulatedTime += sceneDuration;
        }

        // Step B: Concatenate Scenes
        const concatListPath = path.join(jobDir, 'concat_list.txt');
        const concatContent = processedClipPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
        fs.writeFileSync(concatListPath, concatContent);

        const concatenatedVideoPath = path.join(jobDir, 'concatenated.mp4');

        console.log(`[AI Video Render] Concatenating ${processedClipPaths.length} scenes...`);
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(concatListPath)
                .inputOptions(['-f concat', '-safe 0'])
                .outputOptions(['-c copy'])
                .save(concatenatedVideoPath)
                .on('end', () => resolve(concatenatedVideoPath))
                .on('error', reject);
        });

        // Step C: Generate ASS Subtitles File with Centered Viral Margins
        const assPath = path.join(jobDir, 'subtitles.ass');
        const marginV = aspectRatio === '9:16' ? 420 : 60; // Centered in lower third for vertical reels
        
        const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: ${targetWidth}
PlayResY: ${targetHeight}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial Black,${fontSize},&H00FFFFFF,&H000000FF,${outlineColor},${backColor},1,0,0,0,100,100,1,0,1,${outlineWidth},${shadowWidth},2,30,30,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${assEvents}`;

        fs.writeFileSync(assPath, assHeader);

        // Step D: Mix Background Music (BGM) with Voice Audio
        const finalOutputFilename = `${videoTitle.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.mp4`;
        const finalOutputPath = path.join(RENDERS_DIR, finalOutputFilename);

        let selectedBgm = BGM_TRACKS.find(b => b.id === bgmTrackId);
        let localBgmPath = null;

        if (selectedBgm) {
            localBgmPath = path.join(jobDir, 'bgm.mp3');
            if (selectedBgm.audioUrl.startsWith('http')) {
                try {
                    await downloadFile(selectedBgm.audioUrl, localBgmPath);
                } catch (bgmErr) {
                    console.warn('[AI Video Render] Failed to download BGM:', bgmErr.message);
                    localBgmPath = null;
                }
            } else {
                const localBgmRelative = path.join(__dirname, '../public', selectedBgm.audioUrl);
                if (fs.existsSync(localBgmRelative)) {
                    fs.copyFileSync(localBgmRelative, localBgmPath);
                }
            }
        }

        console.log(`[AI Video Render] Finalizing render with word-by-word synchronized subtitles & mixed audio...`);

        const ffmpegCmd = ffmpeg(concatenatedVideoPath);

        if (localBgmPath && fs.existsSync(localBgmPath)) {
            const vol = parseFloat(bgmVolume) || 0.12;
            ffmpegCmd
                .input(localBgmPath)
                .complexFilter([
                    `[0:v]subtitles='${assPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'[v]`,
                    `[1:a]volume=${vol}[bgm]`,
                    `[0:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[a]`
                ])
                .outputOptions([
                    '-map [v]',
                    '-map [a]',
                    '-c:v libx264',
                    '-preset medium',
                    '-crf 20',
                    '-pix_fmt yuv420p',
                    '-c:a aac',
                    '-b:a 192k',
                    '-shortest'
                ]);
        } else {
            ffmpegCmd
                .complexFilter([
                    `[0:v]subtitles='${assPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'[v]`
                ])
                .outputOptions([
                    '-map [v]',
                    '-map 0:a',
                    '-c:v libx264',
                    '-preset medium',
                    '-crf 20',
                    '-pix_fmt yuv420p',
                    '-c:a aac',
                    '-b:a 192k'
                ]);
        }

        await new Promise((resolve, reject) => {
            ffmpegCmd
                .save(finalOutputPath)
                .on('end', () => {
                    console.log(`[AI Video Render] Rendering completed successfully! Output: ${finalOutputPath}`);
                    resolve(finalOutputPath);
                })
                .on('error', (err) => {
                    console.error('[AI Video Render] Final export failed:', err);
                    reject(err);
                });
        });

        // Clean up temporary job folder
        try {
            fs.rmSync(jobDir, { recursive: true, force: true });
        } catch (_) {}

        const downloadUrl = `/uploads/social-media/renders/${finalOutputFilename}`;
        const finalFileSize = fs.existsSync(finalOutputPath) ? fs.statSync(finalOutputPath).size : 0;

        res.status(200).json({
            success: true,
            message: 'AI Video rendered successfully!',
            videoUrl: downloadUrl,
            downloadUrl: downloadUrl,
            duration: accumulatedTime,
            fileSize: finalFileSize,
            aspectRatio,
            title: videoTitle
        });

    } catch (error) {
        console.error('[AI Video Render Error]:', error);
        try {
            fs.rmSync(jobDir, { recursive: true, force: true });
        } catch (_) {}
        res.status(500).json({ error: error.message || 'Video rendering failed.' });
    }
};

// =========================================================================
// 6. UPLOAD CUSTOM USER FOOTAGE FOR SCENES
// =========================================================================
exports.uploadCustomFootage = (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided.' });
        }

        const publicUrl = `/uploads/social-media/${req.file.filename}`;
        const isImage = req.file.mimetype.startsWith('image/');
        res.status(200).json({
            success: true,
            footage: {
                id: `custom-${Date.now()}`,
                title: req.file.originalname,
                category: 'Custom Upload',
                videoUrl: publicUrl,
                thumbnail: publicUrl,
                isImage,
                duration: 15
            }
        });
    } catch (error) {
        console.error('[AI Video Generator] Error in uploadCustomFootage:', error);
        res.status(500).json({ error: 'Failed to upload footage.' });
    }
};

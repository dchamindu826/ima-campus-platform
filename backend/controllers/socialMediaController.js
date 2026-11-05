const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.uploadAndTranscribe = async (req, res) => {
    let tempAudioPath = null;
    try {
        const uploadedFile = (req.files && req.files.length > 0) ? req.files[0] : req.file;
        if (!uploadedFile) {
            return res.status(400).json({ error: 'No media file received' });
        }

        const filePath = uploadedFile.path;
        const fileMime = uploadedFile.mimetype || '';
        const isDirectAudio = fileMime.startsWith('audio/') || filePath.endsWith('.wav') || filePath.endsWith('.mp3');
        const videoUrl = uploadedFile.filename ? `/uploads/social-media/${uploadedFile.filename}` : '';
        const videoPath = uploadedFile.path || '';

        console.log(`[Social Media] Fast Transcribe: Received file ${filePath} (${fileMime}, directAudio: ${isDirectAudio})`);

        let audioFilePath = filePath;
        let mimeType = 'audio/mp3';
        if (filePath.endsWith('.wav') || fileMime.includes('wav')) {
            mimeType = 'audio/wav';
        } else if (filePath.endsWith('.mp3') || fileMime.includes('mp3') || fileMime.includes('mpeg')) {
            mimeType = 'audio/mp3';
        }

        if (!isDirectAudio) {
            const AUDIO_DIR = path.join(__dirname, '../public/uploads/social-media/audio');
            if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
            
            tempAudioPath = path.join(AUDIO_DIR, `temp_fast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}.mp3`);
            
            try {
                console.log(`[Social Media] Extracting lightweight audio from video with FFmpeg...`);
                await new Promise((resolve, reject) => {
                    ffmpeg(filePath)
                        .output(tempAudioPath)
                        .noVideo()
                        .audioCodec('libmp3lame')
                        .audioChannels(1)
                        .audioFrequency(16000)
                        .audioBitrate('32k')
                        .on('end', () => resolve(tempAudioPath))
                        .on('error', (err) => reject(err))
                        .run();
                });
                audioFilePath = tempAudioPath;
                mimeType = 'audio/mp3';
                console.log(`[Social Media] Audio extracted successfully. Size: ${fs.statSync(tempAudioPath).size} bytes.`);
            } catch (ffmpegErr) {
                console.warn('[Social Media] Audio extraction warning, using file directly:', ffmpegErr.message);
                audioFilePath = filePath;
            }
        }

        const audioBuffer = fs.readFileSync(audioFilePath);
        const base64Audio = audioBuffer.toString('base64');

        // 2. High-Accuracy Gemini 2.5 Flash Transcription with JSON Schema
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in backend environment.' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        console.log(`[Social Media] Sending high-accuracy audio to Gemini 2.5 Flash (Sinhala/English Segments)...`);
        const startTime = Date.now();

        const prompt = `You are an expert native Sinhala speech-to-text transcriber and professional video caption editor specializing in Sri Lankan education, lectures, and promo videos.
Listen carefully to the audio and transcribe all spoken content into natural, high-retention video subtitle segments.

CRITICAL INSTRUCTIONS:
1. Sinhala Accuracy: Ensure 100% accurate Sinhala spelling and proper grammar. Pay special attention to academic and technical terms (e.g. සංවර්ධන සන්නිවේදනය, කළමනාකරණය, ගිණුම්කරණය, තොරතුරු තාක්ෂණය, විද්‍යාව, දේශන).
2. Segment Timing: Break down speech into natural, readable subtitle phrases (2 to 5 words per segment, ~2 to 4 seconds each).
3. Precision Timestamps: "start" and "end" timestamps MUST precisely match the exact seconds when the speaker begins and stops speaking each phrase.

Output MUST be a single valid JSON object strictly matching this schema:
{
  "segments": [
    {
      "start": 0.0,
      "end": 2.8,
      "text": "සංවර්ධන සන්නිවේදනය යනු කුමක්ද?"
    }
  ]
}`;

        const result = await model.generateContent({
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: base64Audio } },
                        { text: prompt }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: 'application/json'
            }
        });

        const rawResponse = result.response.text() || '{}';
        console.log(`[Social Media] Gemini AI responded in ${Date.now() - startTime}ms!`);

        let parsed = null;
        try {
            parsed = JSON.parse(rawResponse);
        } catch (parseErr) {
            const firstBrace = rawResponse.indexOf('{');
            const lastBrace = rawResponse.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                try {
                    parsed = JSON.parse(rawResponse.substring(firstBrace, lastBrace + 1));
                } catch (_) {}
            }
        }

        let rawSegments = parsed?.segments || (Array.isArray(parsed) ? parsed : []);

        // Build clean word-by-word captions array (stripped of full stops/punctuation to prevent stray "ග")
        let rawCues = [];
        let idCounter = 1;

        rawSegments.forEach(seg => {
            const start = parseFloat(seg.start);
            const end = parseFloat(seg.end);
            // Strip punctuation like '.', ',', '?', '!' so no stray 'ග' is created in FM fonts
            const text = (seg.text || '').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ').trim();

            if (!isNaN(start) && !isNaN(end) && text) {
                const words = text.split(/\s+/).filter(w => w.length > 0);
                if (words.length <= 1) {
                    rawCues.push({
                        id: idCounter++,
                        start: parseFloat(Math.max(0, start).toFixed(2)),
                        end: parseFloat(Math.max(start + 0.25, end).toFixed(2)),
                        text: words[0] || text
                    });
                } else {
                    const totalDur = Math.max(0.4, end - start);
                    const totalChars = words.reduce((acc, w) => acc + w.length, 0);
                    let currentStart = start;

                    words.forEach((w, wIdx) => {
                        const charWeight = w.length / totalChars;
                        const wordDur = Math.max(0.2, totalDur * charWeight);
                        const wordEnd = (wIdx === words.length - 1) ? end : parseFloat((currentStart + wordDur).toFixed(2));

                        rawCues.push({
                            id: idCounter++,
                            start: parseFloat(currentStart.toFixed(2)),
                            end: parseFloat(Math.max(currentStart + 0.15, wordEnd).toFixed(2)),
                            text: w
                        });

                        currentStart = wordEnd;
                    });
                }
            }
        });

        // Strictly enforce ascending non-overlapping timeline with 40ms gap so CapCut stays strictly on 1 Track
        rawCues.sort((a, b) => a.start - b.start);
        for (let i = 0; i < rawCues.length; i++) {
            const curr = rawCues[i];
            const next = rawCues[i + 1];
            if (curr.end <= curr.start) {
                curr.end = parseFloat((curr.start + 0.2).toFixed(2));
            }
            if (next && curr.end >= next.start) {
                curr.end = parseFloat(Math.max(curr.start + 0.1, next.start - 0.04).toFixed(2));
            }
        }

        const captions = rawCues;
        console.log(`[Social Media] Successfully generated ${captions.length} clean non-overlapping word cues in ${Date.now() - startTime}ms.`);

        res.status(200).json({ 
            videoUrl, 
            videoPath, 
            captions,
            rawSegments,
            message: "Word-by-word transcription successful"
        });

    } catch (e) {
        console.error('[Social Media] Error in uploadAndTranscribe:', e.message);
        res.status(500).json({ error: e.message || "Failed to process video and generate captions." });
    } finally {
        if (tempAudioPath && fs.existsSync(tempAudioPath)) {
            try { fs.unlinkSync(tempAudioPath); } catch (_) {}
        }
    }
};

// Helper to convert #RRGGBB to ASS color &H00BBGGRR
function hexToAssColor(hex) {
    if (!hex) return '&H00FFFFFF';
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (clean.length !== 6) return '&H00FFFFFF';
    const r = hex.substring(0, 2);
    const g = hex.substring(2, 4);
    const b = hex.substring(4, 6);
    return `&H00${b}${g}${r}`;
}

// Format seconds to ASS time format: h:mm:ss.cs (cs = centiseconds)
function formatAssTime(seconds) {
    const sVal = Math.max(0, seconds);
    const h = Math.floor(sVal / 3600);
    const m = Math.floor((sVal % 3600) / 60);
    const s = Math.floor(sVal % 60);
    const cs = Math.floor((sVal % 1) * 100);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

exports.exportVideo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        const captions = JSON.parse(req.body.captions || '[]');
        const styles = JSON.parse(req.body.styles || '{}');
        
        const videoPath = req.file.path;
        const filenameWithoutExt = req.file.filename.split('.').slice(0, -1).join('.');
        const outputPath = path.join(__dirname, `../public/uploads/social-media/${filenameWithoutExt}_exported.mp4`);
        const assPath = path.join(__dirname, `../public/uploads/social-media/${filenameWithoutExt}.ass`);

        // Generate ASS Subtitle File Content
        const primaryColor = hexToAssColor(styles.color || '#ffffff');
        const outlineColor = hexToAssColor(styles.strokeColor || '#000000');
        const shadowColor = hexToAssColor(styles.shadowColor || '#000000');
        const fontSize = styles.fontSize || 36;
        const fontName = styles.fontFamily === 'FM-Abhaya' ? 'FM-Abhaya' : 'Arial Black';
        const outline = styles.strokeWidth || 3;
        
        let assContent = `[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,${outlineColor},${shadowColor},1,0,0,0,100,100,0,0,1,${outline},2,2,10,10,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

        captions.forEach(cap => {
            const start = formatAssTime(cap.start);
            const end = formatAssTime(cap.end);
            const text = (cap.text || '').replace(/\n/g, '\\N');
            assContent += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}\n`;
        });

        fs.writeFileSync(assPath, assContent);
        console.log('[Social Media] Generated ASS file for rendering.');

        res.status(200).json({ 
            message: "Export started", 
            downloadUrl: `/uploads/social-media/${filenameWithoutExt}_exported.mp4`
        });

        // Run FFmpeg in background
        ffmpeg(videoPath)
            .outputOptions([`-vf subtitles='${assPath.replace(/\\/g, '/').replace(/:/g, '\\:')}'`])
            .on('end', () => {
                console.log('[Social Media] Video exported successfully to', outputPath);
                try { fs.unlinkSync(assPath); } catch (_) {}
            })
            .on('error', (err) => {
                console.error('[Social Media] Error during FFmpeg export:', err);
            })
            .save(outputPath);

    } catch (e) {
        console.error('[Social Media] Error in exportVideo:', e);
        if (!res.headersSent) {
            res.status(500).json({ error: "Failed to export video." });
        }
    }
};

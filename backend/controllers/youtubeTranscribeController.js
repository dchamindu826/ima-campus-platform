const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GoogleAIFileManager } = require('@google/generative-ai/server');
const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    AlignmentType,
    ShadingType
} = require('docx');

const YT_DLP_PATH = '/usr/local/bin/yt-dlp';
const FFMPEG_PATH = '/usr/bin/ffmpeg';
const COOKIES_PATH = '/root/IMA-Campus/yt_cookies.txt';
const TEMP_DIR = path.join(__dirname, '../temp_transcripts');

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    try {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    } catch (e) {
        console.error('Failed to create temp_transcripts directory:', e);
    }
}

// In-memory job store for background processing
// Map<jobId, JobState>
const jobs = new Map();

// Periodic cleanup of jobs older than 2 hours to prevent memory leaks
setInterval(() => {
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
    for (const [id, job] of jobs.entries()) {
        if (job.createdAt < twoHoursAgo) {
            jobs.delete(id);
        }
    }
}, 30 * 60 * 1000).unref();


/**
 * Validates and extracts 11-character YouTube video ID
 */
function extractVideoId(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    const regex = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/;
    const match = trimmed.match(regex);
    return match ? match[1] : null;
}

/**
 * Format seconds to HH:MM:SS string
 */
function formatSeconds(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00:00';
    const totalSec = Math.floor(seconds);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

/**
 * Parse time string (HH:MM:SS or MM:SS) to seconds
 */
function parseTimeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const parts = timeStr.trim().split(':').map(Number);
    if (parts.length === 3) {
        return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
    } else if (parts.length === 2) {
        return (parts[0] * 60) + parts[1];
    }
    return 0;
}

const axios = require('axios');

/**
 * Step 1: GET /api/youtube-transcribe/info
 * Retrieves video metadata (Title, Duration, Thumbnail, Channel, Subtitles)
 * Uses YouTube oEmbed as guaranteed fallback if yt-dlp faces bot challenges
 */
exports.getVideoInfo = async (req, res) => {
    try {
        const rawUrl = req.query.url || req.body?.url;
        const videoId = extractVideoId(rawUrl);

        if (!videoId) {
            return res.status(400).json({
                error: 'Invalid YouTube URL. Please provide a valid YouTube video link or Shorts URL.'
            });
        }

        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        
        // 1. Fetch guaranteed baseline metadata from YouTube oEmbed API
        let oEmbedData = null;
        try {
            const oembedRes = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, {
                timeout: 5000
            });
            if (oembedRes.data) {
                oEmbedData = oembedRes.data;
            }
        } catch (oeErr) {
            console.warn('[YT Transcribe] oEmbed fetch warning:', oeErr.message);
        }

        // 2. Fetch extended metadata (duration, subtitles) via yt-dlp
        const args = ['--dump-json', '--skip-download', '--no-warnings'];
        if (fs.existsSync(COOKIES_PATH)) {
            args.push('--cookies', COOKIES_PATH);
        }
        args.push(videoUrl);

        execFile(YT_DLP_PATH, args, { maxBuffer: 10 * 1024 * 1024, timeout: 15000 }, (err, stdout, stderr) => {
            if (err) {
                console.warn('[YT Transcribe] yt-dlp warning (using oEmbed fallback):', err.message);

                // If oEmbed data exists, succeed with oEmbed baseline info!
                if (oEmbedData) {
                    return res.json({
                        success: true,
                        videoId,
                        url: videoUrl,
                        title: oEmbedData.title || 'YouTube Video',
                        duration: 0,
                        durationFormatted: 'Duration pending download',
                        channel: oEmbedData.author_name || 'YouTube Channel',
                        thumbnail: oEmbedData.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        description: '',
                        hasSinhalaCaptions: false,
                        hasEnglishCaptions: false,
                        availableLanguages: [],
                        botChallengeWarning: err.message.includes('confirm you’re not a bot') || err.message.includes('LOGIN_REQUIRED')
                    });
                }

                return res.status(400).json({
                    error: 'Could not fetch video information. Please ensure the link is public and accessible.'
                });
            }

            try {
                const info = JSON.parse(stdout);
                const duration = info.duration || 0;
                const subtitles = info.subtitles || {};
                const autoCaptions = info.automatic_captions || {};

                const availableLangs = new Set([
                    ...Object.keys(subtitles),
                    ...Object.keys(autoCaptions)
                ]);

                const hasSinhalaCaptions = availableLangs.has('si') || availableLangs.has('si-orig');
                const hasEnglishCaptions = availableLangs.has('en') || availableLangs.has('en-orig');

                return res.json({
                    success: true,
                    videoId,
                    url: videoUrl,
                    title: info.title || oEmbedData?.title || 'Untitled YouTube Video',
                    duration,
                    durationFormatted: formatSeconds(duration),
                    channel: info.channel || info.uploader || oEmbedData?.author_name || 'Unknown Channel',
                    thumbnail: info.thumbnail || oEmbedData?.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    description: (info.description || '').slice(0, 300),
                    hasSinhalaCaptions,
                    hasEnglishCaptions,
                    availableLanguages: Array.from(availableLangs),
                    botChallengeWarning: false
                });
            } catch (parseErr) {
                // If parse fails but oEmbed succeeded, use oEmbed
                if (oEmbedData) {
                    return res.json({
                        success: true,
                        videoId,
                        url: videoUrl,
                        title: oEmbedData.title,
                        duration: 0,
                        durationFormatted: '00:00:00',
                        channel: oEmbedData.author_name,
                        thumbnail: oEmbedData.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        description: '',
                        hasSinhalaCaptions: false,
                        hasEnglishCaptions: false,
                        availableLanguages: []
                    });
                }
                return res.status(500).json({ error: 'Failed to parse video metadata response.' });
            }
        });
    } catch (e) {
        console.error('[YT Transcribe] Error in getVideoInfo:', e);
        res.status(500).json({ error: e.message || 'Internal server error' });
    }
};

/**
 * Step 2: POST /api/youtube-transcribe/start
 * Starts background transcription job
 */
exports.startTranscription = async (req, res) => {
    try {
        const { url, engine = 'gemini', generateSummary = true, chunkMinutes = 15 } = req.body;
        const videoId = extractVideoId(url);

        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL provided.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                error: 'GEMINI_API_KEY is not configured on the server. Please contact system administrator.'
            });
        }

        const jobId = crypto.randomUUID();
        const initialJobState = {
            id: jobId,
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            status: 'queued',
            progress: 5,
            stage: 'Queued',
            message: 'Initializing video analysis pipeline...',
            createdAt: Date.now(),
            engine,
            metadata: null,
            result: null,
            error: null
        };

        jobs.set(jobId, initialJobState);

        // Run background pipeline without awaiting so caller gets instant jobId
        runTranscriptionPipeline(jobId, videoId, { engine, generateSummary, chunkMinutes }).catch((err) => {
            console.error(`[YT Transcribe] Job ${jobId} failed:`, err);
            const j = jobs.get(jobId);
            if (j) {
                j.status = 'failed';
                j.stage = 'Failed';
                j.message = err.message || 'An unexpected error occurred during transcription.';
                j.error = err.message;
            }
        });

        res.json({
            success: true,
            jobId,
            message: 'Transcription job queued and running in background.'
        });
    } catch (e) {
        console.error('[YT Transcribe] Error starting transcription:', e);
        res.status(500).json({ error: e.message || 'Server error' });
    }
};

/**
 * Step 3: GET /api/youtube-transcribe/status/:jobId
 * Returns current progress and final result of the job
 */
exports.getJobStatus = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = jobs.get(jobId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found or expired.' });
        }

        res.json({
            success: true,
            job: {
                id: job.id,
                status: job.status,
                progress: job.progress,
                stage: job.stage,
                message: job.message,
                metadata: job.metadata,
                result: job.result,
                error: job.error
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

/**
 * Step 4: POST /api/youtube-transcribe/export-docx
 * Generates and downloads a beautifully styled Word Document (.docx)
 */
exports.exportDocx = async (req, res) => {
    try {
        const { title, channel, durationFormatted, url, summary, keyTakeaways, segments, fullText, videoId } = req.body;
        const safeVideoId = videoId || extractVideoId(url) || 'video';

        const docTitle = title || 'YouTube Video Transcription';
        const children = [];

        // Title
        children.push(
            new Paragraph({
                text: docTitle,
                heading: HeadingLevel.TITLE,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 }
            })
        );

        // Subtitle / Branding
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: 'IMA Campus System Administration - High Precision AI Transcription',
                        italics: true,
                        size: 20,
                        color: '64748B'
                    })
                ],
                spacing: { after: 400 }
            })
        );

        // Metadata Table
        const metadataRows = [
            ['Source Video URL:', url || 'N/A'],
            ['Channel / Speaker:', channel || 'N/A'],
            ['Video Duration:', durationFormatted || 'N/A'],
            ['Transcription Date:', new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' }) + ' (SLST)'],
            ['AI Speech Engine:', 'Google Gemini 2.5 Flash Native Speech-to-Text']
        ];

        const table = new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: metadataRows.map(([label, val]) =>
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 30, type: WidthType.PERCENTAGE },
                            shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: label, bold: true, size: 20, color: '1E293B' })]
                                })
                            ]
                        }),
                        new TableCell({
                            width: { size: 70, type: WidthType.PERCENTAGE },
                            children: [
                                new Paragraph({
                                    children: [new TextRun({ text: val, size: 20, color: '334155' })]
                                })
                            ]
                        })
                    ]
                })
            )
        });

        children.push(table);
        children.push(new Paragraph({ text: '', spacing: { after: 400 } }));

        // Executive Summary (if available)
        if (summary) {
            children.push(
                new Paragraph({
                    text: 'Executive Summary (දේශනයේ / වීඩියෝවේ සාරාංශය)',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 150 }
                })
            );
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: summary,
                            size: 22,
                            color: '0F172A'
                        })
                    ],
                    spacing: { after: 300 }
                })
            );
        }

        // Key Takeaways (if available)
        if (Array.isArray(keyTakeaways) && keyTakeaways.length > 0) {
            children.push(
                new Paragraph({
                    text: 'Key Takeaways & Highlights (ප්‍රධාන සාකච්ඡා කරුණු)',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 200, after: 150 }
                })
            );

            keyTakeaways.forEach((point, idx) => {
                children.push(
                    new Paragraph({
                        bullet: { level: 0 },
                        children: [
                            new TextRun({
                                text: point,
                                size: 22,
                                color: '1E293B'
                            })
                        ],
                        spacing: { after: 100 }
                    })
                );
            });

            children.push(new Paragraph({ text: '', spacing: { after: 300 } }));
        }

        // Complete Timestamped Transcript
        children.push(
            new Paragraph({
                text: 'Complete Transcript (සම්පූර්ණ පිටපත)',
                heading: HeadingLevel.HEADING_1,
                spacing: { before: 300, after: 200 }
            })
        );

        if (Array.isArray(segments) && segments.length > 0) {
            segments.forEach((seg) => {
                children.push(
                    new Paragraph({
                        spacing: { after: 120 },
                        children: [
                            new TextRun({
                                text: `[${seg.start || '00:00:00'}] `,
                                bold: true,
                                color: '2563EB',
                                size: 20
                            }),
                            new TextRun({
                                text: seg.text || '',
                                size: 22,
                                color: '1E293B'
                            })
                        ]
                    })
                );
            });
        } else if (fullText) {
            children.push(
                new Paragraph({
                    children: [
                        new TextRun({
                            text: fullText,
                            size: 22,
                            color: '1E293B'
                        })
                    ]
                })
            );
        }

        const doc = new Document({
            sections: [
                {
                    properties: {},
                    children
                }
            ]
        });

        const buffer = await Packer.toBuffer(doc);
        const safeFilename = `Transcript_${safeVideoId}_${Date.now()}.docx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
        res.send(buffer);
    } catch (e) {
        console.error('[YT Transcribe] Docx export error:', e);
        res.status(500).json({ error: 'Failed to generate Word document.' });
    }
};

/**
 * Core Background Worker Pipeline
 */
async function runTranscriptionPipeline(jobId, videoId, options) {
    const job = jobs.get(jobId);
    if (!job) return;

    const apiKey = process.env.GEMINI_API_KEY;
    const fileManager = new GoogleAIFileManager(apiKey);
    const genAI = new GoogleGenerativeAI(apiKey);

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const baseTempName = `job_${jobId}_${videoId}`;
    const audioFilePath = path.join(TEMP_DIR, `${baseTempName}.mp3`);
    const createdTempFiles = [audioFilePath];
    const uploadedGeminiFileNames = [];

    const updateJob = (updates) => {
        const current = jobs.get(jobId);
        if (current) {
            Object.assign(current, updates);
        }
    };

    try {
        // Step A: Fetch Full Metadata
        updateJob({
            status: 'processing',
            progress: 10,
            stage: 'Metadata Extraction',
            message: 'Extracting video duration and details...'
        });

        const metaArgs = ['--dump-json', '--skip-download', '--no-warnings'];
        if (fs.existsSync(COOKIES_PATH)) metaArgs.push('--cookies', COOKIES_PATH);
        metaArgs.push(videoUrl);

        const metadata = await new Promise((resolve) => {
            execFile(YT_DLP_PATH, metaArgs, { maxBuffer: 10 * 1024 * 1024 }, async (err, stdout) => {
                if (!err && stdout) {
                    try {
                        const info = JSON.parse(stdout);
                        return resolve({
                            title: info.title || 'Untitled YouTube Video',
                            duration: info.duration || 0,
                            durationFormatted: formatSeconds(info.duration || 0),
                            channel: info.channel || info.uploader || 'Unknown Channel',
                            thumbnail: info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                            description: info.description || '',
                            subtitles: info.subtitles || {},
                            automaticCaptions: info.automatic_captions || {}
                        });
                    } catch (pe) {}
                }

                // Fallback to oEmbed!
                try {
                    const oe = await axios.get(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`, { timeout: 5000 });
                    return resolve({
                        title: oe.data.title || 'YouTube Video',
                        duration: 0,
                        durationFormatted: 'Duration pending',
                        channel: oe.data.author_name || 'YouTube Channel',
                        thumbnail: oe.data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        description: '',
                        subtitles: {},
                        automaticCaptions: {}
                    });
                } catch (oeErr) {
                    return resolve({
                        title: 'YouTube Video',
                        duration: 0,
                        durationFormatted: '00:00:00',
                        channel: 'YouTube',
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        description: '',
                        subtitles: {},
                        automaticCaptions: {}
                    });
                }
            });
        });

        updateJob({
            metadata,
            progress: 15,
            stage: 'Audio Stream Download',
            message: `Downloading lightweight 32kbps mono audio for "${metadata.title.slice(0, 45)}..."`
        });

        // Step B: Download 32kbps mono audio stream via yt-dlp with auto-fallback
        const runYtDlp = (args) => new Promise((resolve, reject) => {
            execFile(YT_DLP_PATH, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
                if (err) return reject({ err, stderr: stderr || '' });
                if (!fs.existsSync(audioFilePath)) return reject({ err: new Error('Audio file not found on disk'), stderr: '' });
                resolve();
            });
        });

        const baseArgs = [
            '-x',
            '--audio-format', 'mp3',
            '--audio-quality', '32k',
            '--no-playlist',
            '--no-warnings',
            '--remote-components', 'ejs:github',
            '-o', audioFilePath
        ];

        let downloadSuccess = false;
        let lastErrorText = '';

        // Attempt 1: Try with cookies if present
        if (fs.existsSync(COOKIES_PATH)) {
            try {
                console.log(`[YT Transcribe] Attempt 1: Downloading audio for ${videoId} using cookies...`);
                await runYtDlp([...baseArgs, '--cookies', COOKIES_PATH, videoUrl]);
                downloadSuccess = true;
            } catch (fail1) {
                lastErrorText = (fail1.err?.message || '') + ' ' + (fail1.stderr || '');
                console.warn('[YT Transcribe] Attempt 1 with cookies failed:', lastErrorText);
            }
        }

        // Attempt 2: If attempt 1 failed or no cookies, try directly (uses bgutil PO Token provider)
        if (!downloadSuccess) {
            try {
                console.log(`[YT Transcribe] Attempt 2: Downloading audio for ${videoId} directly (with PO token)...`);
                await runYtDlp([...baseArgs, videoUrl]);
                downloadSuccess = true;
            } catch (fail2) {
                lastErrorText = (fail2.err?.message || '') + ' ' + (fail2.stderr || '');
                console.warn('[YT Transcribe] Attempt 2 directly failed:', lastErrorText);
            }
        }

        if (!downloadSuccess) {
            let cleanErr = 'YouTube is blocking audio download from cloud server IP for this video.';
            if (
                lastErrorText.includes('confirm you’re not a bot') ||
                lastErrorText.includes('LOGIN_REQUIRED') ||
                lastErrorText.includes('Sign in') ||
                lastErrorText.includes('The page needs to be reloaded') ||
                lastErrorText.includes('403') ||
                lastErrorText.includes('bot')
            ) {
                cleanErr = 'YouTube requires sign-in verification for this specific video ("Sign in to confirm you’re not a bot"). Please switch to the "Direct Audio Upload" tab above to transcribe immediately, or update your YouTube cookies.';
            }
            throw new Error(cleanErr);
        }


        const fileStats = fs.statSync(audioFilePath);
        console.log(`[YT Transcribe] Downloaded audio file size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`);

        const duration = metadata.duration || 0;
        let allSegments = [];
        let fullTranscriptText = '';

        // Step C: Transcribe with Gemini 2.5 Flash
        // If duration <= 15 minutes (900 seconds), single shot
        // If duration > 15 minutes, chunk using ffmpeg to avoid output token limits and guarantee completeness
        const CHUNK_SECONDS = (options.chunkMinutes || 15) * 60; // 900 seconds (15 mins)

        if (duration <= CHUNK_SECONDS) {
            updateJob({
                progress: 40,
                stage: 'AI Speech-to-Text',
                message: 'Uploading audio to Google Gemini 2.5 Flash Speech Engine...'
            });

            const uploadResult = await fileManager.uploadFile(audioFilePath, {
                mimeType: 'audio/mp3',
                displayName: `audio_${jobId}`
            });
            uploadedGeminiFileNames.push(uploadResult.file.name);

            updateJob({
                progress: 60,
                stage: 'AI Transcription in Progress',
                message: 'Gemini 2.5 Flash is transcribing Sinhala speech with precision timestamps...'
            });

            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const prompt = getTranscriptionPrompt(0);

            const result = await model.generateContent([
                {
                    fileData: {
                        mimeType: uploadResult.file.mimeType,
                        fileUri: uploadResult.file.uri
                    }
                },
                { text: prompt }
            ]);

            const rawResponse = result.response.text();
            const parsed = parseGeminiTranscriptionResponse(rawResponse, 0);
            allSegments = parsed.segments;
            fullTranscriptText = parsed.fullText;
        } else {
            // Long video (> 15 mins up to 3+ hours): Split into 15-minute chunks using ffmpeg
            updateJob({
                progress: 25,
                stage: 'Audio Segmentation',
                message: `Video is ${formatSeconds(duration)} long. Slicing into 15-minute segments for maximum fidelity...`
            });

            const chunkPattern = path.join(TEMP_DIR, `${baseTempName}_chunk_%03d.mp3`);
            await new Promise((resolve, reject) => {
                const ffmpegArgs = [
                    '-i',
                    audioFilePath,
                    '-f',
                    'segment',
                    '-segment_time',
                    String(CHUNK_SECONDS),
                    '-c',
                    'copy',
                    chunkPattern
                ];
                execFile(FFMPEG_PATH, ffmpegArgs, (err) => {
                    if (err) return reject(new Error('Failed to segment audio file into chunks.'));
                    resolve();
                });
            });

            // Find all created chunk files
            const files = fs.readdirSync(TEMP_DIR);
            const chunkFiles = files
                .filter((f) => f.startsWith(`${baseTempName}_chunk_`) && f.endsWith('.mp3'))
                .sort()
                .map((f) => path.join(TEMP_DIR, f));

            chunkFiles.forEach((cf) => createdTempFiles.push(cf));
            const totalChunks = chunkFiles.length;
            console.log(`[YT Transcribe] Audio sliced into ${totalChunks} chunks.`);

            // Process chunks sequentially or with slight concurrency
            for (let i = 0; i < totalChunks; i++) {
                const chunkFile = chunkFiles[i];
                const baseSeconds = i * CHUNK_SECONDS;
                const progressVal = 30 + Math.round((i / totalChunks) * 55);

                const startLabel = formatSeconds(baseSeconds);
                const endLabel = formatSeconds(Math.min(baseSeconds + CHUNK_SECONDS, duration));

                updateJob({
                    progress: progressVal,
                    stage: `Transcribing Part ${i + 1} of ${totalChunks}`,
                    message: `Transcribing audio segment ${i + 1}/${totalChunks} [${startLabel} - ${endLabel}]...`
                });

                console.log(`[YT Transcribe] Processing chunk ${i + 1}/${totalChunks} (${chunkFile})...`);
                const chunkUpload = await fileManager.uploadFile(chunkFile, {
                    mimeType: 'audio/mp3',
                    displayName: `chunk_${jobId}_${i}`
                });
                uploadedGeminiFileNames.push(chunkUpload.file.name);

                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const prompt = getTranscriptionPrompt(baseSeconds);

                const result = await model.generateContent([
                    {
                        fileData: {
                            mimeType: chunkUpload.file.mimeType,
                            fileUri: chunkUpload.file.uri
                        }
                    },
                    { text: prompt }
                ]);

                const rawResponse = result.response.text();
                const parsed = parseGeminiTranscriptionResponse(rawResponse, baseSeconds);

                if (parsed.segments && parsed.segments.length > 0) {
                    allSegments = allSegments.concat(parsed.segments);
                }
                if (parsed.fullText) {
                    fullTranscriptText += (fullTranscriptText ? '\n\n' : '') + parsed.fullText;
                }

                // Delete chunk from Gemini API immediately to keep quota fresh
                try {
                    await fileManager.deleteFile(chunkUpload.file.name);
                    const idx = uploadedGeminiFileNames.indexOf(chunkUpload.file.name);
                    if (idx !== -1) uploadedGeminiFileNames.splice(idx, 1);
                } catch (delErr) {
                    console.warn('[YT Transcribe] Failed to delete remote chunk file:', delErr.message);
                }
            }
        }

        // Fallback if fullTranscriptText empty but segments exist
        if (!fullTranscriptText && allSegments.length > 0) {
            fullTranscriptText = allSegments.map((s) => s.text).join(' ');
        }

        // Step D: Generate Executive Summary & Key Takeaways
        let summary = '';
        let keyTakeaways = [];

        if (options.generateSummary && fullTranscriptText.length > 50) {
            updateJob({
                progress: 90,
                stage: 'Executive Summary',
                message: 'Generating AI Executive Summary & Key Takeaways...'
            });

            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                // If text is extremely long (> 50,000 words), take a balanced sample for the summary
                const textForSummary = fullTranscriptText.length > 100000
                    ? fullTranscriptText.slice(0, 100000)
                    : fullTranscriptText;

                const summaryPrompt = `You are an expert academic and professional analyst.
Based on the following transcription of a video (in Sinhala/English), produce a structured JSON summary.
Ensure accurate, high-quality Sinhala language output.

Strict JSON format:
{
  "summary": "Detailed, coherent 3 to 5 paragraph summary of the entire video/lecture in Sinhala.",
  "keyTakeaways": [
    "Key takeaway point 1 in Sinhala",
    "Key takeaway point 2 in Sinhala",
    "Key takeaway point 3 in Sinhala",
    "Key takeaway point 4 in Sinhala",
    "Key takeaway point 5 in Sinhala"
  ]
}

TRANSCRIPT:
${textForSummary}`;

                const summaryResult = await model.generateContent(summaryPrompt);
                const summaryRaw = summaryResult.response.text();
                const jsonMatch = summaryRaw.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsedSummary = JSON.parse(jsonMatch[0]);
                    summary = parsedSummary.summary || '';
                    keyTakeaways = parsedSummary.keyTakeaways || [];
                }
            } catch (sumErr) {
                console.warn('[YT Transcribe] Summary generation warning:', sumErr.message);
            }
        }

        // Step E: Complete Job
        const wordCount = fullTranscriptText ? fullTranscriptText.trim().split(/\s+/).length : 0;
        updateJob({
            status: 'completed',
            progress: 100,
            stage: 'Completed',
            message: 'Transcription successfully generated!',
            result: {
                videoId,
                url: videoUrl,
                metadata,
                segments: allSegments,
                fullText: fullTranscriptText,
                summary,
                keyTakeaways,
                stats: {
                    totalSegments: allSegments.length,
                    wordCount,
                    durationFormatted: metadata.durationFormatted
                }
            }
        });

        console.log(`[YT Transcribe] Job ${jobId} completed successfully! Total segments: ${allSegments.length}, Word count: ${wordCount}`);
    } catch (err) {
        console.error(`[YT Transcribe] Pipeline execution error on job ${jobId}:`, err);
        updateJob({
            status: 'failed',
            stage: 'Failed',
            progress: 0,
            message: err.message || 'Transcription failed.',
            error: err.message
        });
    } finally {
        // Clean up all local temporary audio files
        for (const filePath of createdTempFiles) {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`[YT Transcribe] Cleaned up temp file: ${filePath}`);
                }
            } catch (cleanErr) {
                console.warn(`[YT Transcribe] Warning removing temp file ${filePath}:`, cleanErr.message);
            }
        }

        // Clean up any remaining Gemini uploaded files
        for (const remoteName of uploadedGeminiFileNames) {
            try {
                await fileManager.deleteFile(remoteName);
                console.log(`[YT Transcribe] Cleaned up Gemini remote file: ${remoteName}`);
            } catch (remErr) {
                // Ignore if already deleted
            }
        }
    }
}

/**
 * Returns prompt for Gemini 2.5 Flash audio transcription
 */
function getTranscriptionPrompt(baseOffsetSeconds = 0) {
    const offsetStr = formatSeconds(baseOffsetSeconds);
    return `You are an expert native Sinhala speech-to-text transcriber and professional video caption editor.
Listen carefully to the provided audio and transcribe all spoken dialogue into natural, highly accurate Sinhala text.
If English words or Singlish technical terms (like IT, management, marketing, zoom, assignment, system) are spoken, transcribe them naturally in Sinhala script or English where appropriate.

CRITICAL INSTRUCTIONS:
1. Precision Timestamps: Provide timestamps in format "HH:MM:SS" or "MM:SS".
   Note: The audio starts at baseline timestamp offset [${offsetStr}].
2. Natural Segments: Group spoken dialogue into natural, coherent sentences or phrases (each segment 15 to 45 seconds).
3. Do NOT skip any content or summarize here - provide full verbatim transcription.
4. Output MUST be valid JSON only matching this schema:

{
  "segments": [
    {
      "start": "00:00:00",
      "end": "00:00:25",
      "text": "spoken Sinhala text here"
    }
  ],
  "fullText": "Full continuous transcription of the audio..."
}`;
}

/**
 * Parses Gemini audio transcription response
 */
function parseGeminiTranscriptionResponse(rawText, baseOffsetSeconds = 0) {
    try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const data = JSON.parse(jsonMatch[0]);
            const rawSegments = data.segments || [];

            const formattedSegments = rawSegments.map((seg) => {
                let startSec = parseTimeToSeconds(seg.start);
                let endSec = parseTimeToSeconds(seg.end);

                // If timestamps are relative to chunk, add baseOffsetSeconds
                if (startSec < baseOffsetSeconds) {
                    startSec += baseOffsetSeconds;
                    endSec += baseOffsetSeconds;
                }

                return {
                    start: formatSeconds(startSec),
                    end: formatSeconds(endSec > startSec ? endSec : startSec + 15),
                    text: (seg.text || '').trim()
                };
            });

            return {
                segments: formattedSegments,
                fullText: data.fullText || formattedSegments.map((s) => s.text).join(' ')
            };
        }
    } catch (e) {
        console.warn('[YT Transcribe] Error parsing JSON response from Gemini:', e.message);
    }

    // Fallback: Clean raw text
    const cleanLines = rawText
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('```') && !l.startsWith('{') && !l.startsWith('}'));

    const fallbackSegments = cleanLines.map((line, idx) => ({
        start: formatSeconds(baseOffsetSeconds + idx * 30),
        end: formatSeconds(baseOffsetSeconds + (idx + 1) * 30),
        text: line.replace(/^-\s*/, '')
    }));

    return {
        segments: fallbackSegments,
        fullText: cleanLines.join(' ')
    };
}

/**
 * Step 5: POST /api/youtube-transcribe/upload-audio
 * Accepts direct audio file upload and runs transcription
 */
exports.transcribeUploadedAudio = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio or media file uploaded.' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
        }

        const jobId = crypto.randomUUID();
        const originalName = req.file.originalname || 'Audio File';
        const safeTitle = req.body.title || originalName.replace(/\.[^/.]+$/, '');
        const generateSummary = req.body.generateSummary === 'true' || req.body.generateSummary === true;

        const initialJobState = {
            id: jobId,
            videoId: null,
            url: null,
            status: 'queued',
            progress: 10,
            stage: 'Audio Uploaded',
            message: `Audio file "${safeTitle}" received. Initializing transcription...`,
            createdAt: Date.now(),
            engine: 'gemini',
            metadata: {
                title: safeTitle,
                channel: 'Direct File Upload',
                duration: 0,
                durationFormatted: 'Calculating...',
                thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'
            },
            result: null,
            error: null
        };

        jobs.set(jobId, initialJobState);

        // Run async background processing
        runAudioPipeline(jobId, req.file.path, safeTitle, { generateSummary }).catch((err) => {
            console.error(`[YT Transcribe] Audio upload job ${jobId} failed:`, err);
            const j = jobs.get(jobId);
            if (j) {
                j.status = 'failed';
                j.stage = 'Failed';
                j.message = err.message || 'Audio transcription failed.';
                j.error = err.message;
            }
        });

        res.json({
            success: true,
            jobId,
            message: 'Audio upload received and transcription started in background.'
        });
    } catch (e) {
        console.error('[YT Transcribe] Error in transcribeUploadedAudio:', e);
        res.status(500).json({ error: e.message || 'Server error' });
    }
};

/**
 * Pipeline for directly uploaded audio files
 */
async function runAudioPipeline(jobId, rawFilePath, title, options) {
    const job = jobs.get(jobId);
    if (!job) return;

    const apiKey = process.env.GEMINI_API_KEY;
    const fileManager = new GoogleAIFileManager(apiKey);
    const genAI = new GoogleGenerativeAI(apiKey);

    const baseTempName = `direct_${jobId}`;
    const normalizedAudioPath = path.join(TEMP_DIR, `${baseTempName}.mp3`);
    const createdTempFiles = [rawFilePath, normalizedAudioPath];
    const uploadedGeminiFileNames = [];

    const updateJob = (updates) => {
        const current = jobs.get(jobId);
        if (current) {
            Object.assign(current, updates);
        }
    };

    try {
        updateJob({
            status: 'processing',
            progress: 20,
            stage: 'Converting Audio',
            message: 'Optimizing audio format (32kbps mono MP3) for fastest AI transcription...'
        });

        // Convert uploaded file to 32kbps mono mp3 using ffmpeg
        await new Promise((resolve, reject) => {
            const ffmpegArgs = [
                '-i', rawFilePath,
                '-vn',
                '-acodec', 'libmp3lame',
                '-ac', '1',
                '-ar', '16000',
                '-b:a', '32k',
                '-y',
                normalizedAudioPath
            ];
            execFile(FFMPEG_PATH, ffmpegArgs, (err) => {
                if (err) return reject(new Error('Failed to process audio with FFmpeg.'));
                resolve();
            });
        });

        // Get duration with ffprobe
        const durationSec = await new Promise((resolve) => {
            execFile('/usr/bin/ffprobe', [
                '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                normalizedAudioPath
            ], (err, stdout) => {
                if (!err && stdout) {
                    const parsed = parseFloat(stdout.trim());
                    if (!isNaN(parsed)) return resolve(parsed);
                }
                resolve(60); // Default estimate if probe fails
            });
        });

        const durationFormatted = formatSeconds(durationSec);
        updateJob({
            metadata: {
                title,
                channel: 'Direct File Upload',
                duration: durationSec,
                durationFormatted,
                thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'
            },
            progress: 35,
            stage: 'AI Transcribing',
            message: `Transcribing ${durationFormatted} of spoken dialogue with Google Gemini 2.5 Flash...`
        });

        const CHUNK_SECONDS = 900; // 15 mins
        let allSegments = [];
        let fullTranscriptText = '';

        if (durationSec <= CHUNK_SECONDS) {
            const uploadResult = await fileManager.uploadFile(normalizedAudioPath, {
                mimeType: 'audio/mp3',
                displayName: `upload_${jobId}`
            });
            uploadedGeminiFileNames.push(uploadResult.file.name);

            updateJob({ progress: 65, stage: 'AI Processing', message: 'Generating Sinhala transcript...' });

            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const prompt = getTranscriptionPrompt(0);

            const result = await model.generateContent([
                {
                    fileData: {
                        mimeType: uploadResult.file.mimeType,
                        fileUri: uploadResult.file.uri
                    }
                },
                { text: prompt }
            ]);

            const rawResponse = result.response.text();
            const parsed = parseGeminiTranscriptionResponse(rawResponse, 0);
            allSegments = parsed.segments;
            fullTranscriptText = parsed.fullText;
        } else {
            // Slicing into 15 min chunks
            const chunkPattern = path.join(TEMP_DIR, `${baseTempName}_chunk_%03d.mp3`);
            await new Promise((resolve, reject) => {
                const args = [
                    '-i', normalizedAudioPath,
                    '-f', 'segment',
                    '-segment_time', String(CHUNK_SECONDS),
                    '-c', 'copy',
                    chunkPattern
                ];
                execFile(FFMPEG_PATH, args, (err) => {
                    if (err) return reject(new Error('Failed to segment audio file.'));
                    resolve();
                });
            });

            const files = fs.readdirSync(TEMP_DIR);
            const chunkFiles = files
                .filter(f => f.startsWith(`${baseTempName}_chunk_`) && f.endsWith('.mp3'))
                .sort()
                .map(f => path.join(TEMP_DIR, f));

            chunkFiles.forEach(cf => createdTempFiles.push(cf));
            const totalChunks = chunkFiles.length;

            for (let i = 0; i < totalChunks; i++) {
                const chunkFile = chunkFiles[i];
                const baseSeconds = i * CHUNK_SECONDS;
                const progressVal = 35 + Math.round((i / totalChunks) * 50);

                updateJob({
                    progress: progressVal,
                    stage: `Transcribing Part ${i + 1} of ${totalChunks}`,
                    message: `Transcribing segment ${i + 1}/${totalChunks} [${formatSeconds(baseSeconds)}]...`
                });

                const chunkUpload = await fileManager.uploadFile(chunkFile, {
                    mimeType: 'audio/mp3',
                    displayName: `chunk_${jobId}_${i}`
                });
                uploadedGeminiFileNames.push(chunkUpload.file.name);

                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const prompt = getTranscriptionPrompt(baseSeconds);

                const result = await model.generateContent([
                    {
                        fileData: {
                            mimeType: chunkUpload.file.mimeType,
                            fileUri: chunkUpload.file.uri
                        }
                    },
                    { text: prompt }
                ]);

                const rawResponse = result.response.text();
                const parsed = parseGeminiTranscriptionResponse(rawResponse, baseSeconds);
                if (parsed.segments && parsed.segments.length > 0) {
                    allSegments = allSegments.concat(parsed.segments);
                }
                if (parsed.fullText) {
                    fullTranscriptText += (fullTranscriptText ? '\n\n' : '') + parsed.fullText;
                }

                try {
                    await fileManager.deleteFile(chunkUpload.file.name);
                    const idx = uploadedGeminiFileNames.indexOf(chunkUpload.file.name);
                    if (idx !== -1) uploadedGeminiFileNames.splice(idx, 1);
                } catch (e) {}
            }
        }

        if (!fullTranscriptText && allSegments.length > 0) {
            fullTranscriptText = allSegments.map(s => s.text).join(' ');
        }

        // Summary
        let summary = '';
        let keyTakeaways = [];
        if (options.generateSummary && fullTranscriptText.length > 50) {
            updateJob({ progress: 90, stage: 'Executive Summary', message: 'Generating AI Executive Summary & Points...' });
            try {
                const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                const textForSummary = fullTranscriptText.slice(0, 100000);
                const summaryPrompt = `Based on the following transcription, generate a JSON object with:
"summary": "Detailed summary in Sinhala.",
"keyTakeaways": ["Key point 1 in Sinhala", "Key point 2 in Sinhala", "Key point 3 in Sinhala"]
TRANSCRIPT: ${textForSummary}`;
                const resSum = await model.generateContent(summaryPrompt);
                const jsonMatch = resSum.response.text().match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    summary = parsed.summary || '';
                    keyTakeaways = parsed.keyTakeaways || [];
                }
            } catch (sumErr) {
                console.warn('[YT Transcribe] Summary error:', sumErr.message);
            }
        }

        const wordCount = fullTranscriptText ? fullTranscriptText.trim().split(/\s+/).length : 0;
        updateJob({
            status: 'completed',
            progress: 100,
            stage: 'Completed',
            message: 'Transcription successfully generated!',
            result: {
                videoId: null,
                url: null,
                metadata: {
                    title,
                    channel: 'Direct File Upload',
                    duration: durationSec,
                    durationFormatted,
                    thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&auto=format&fit=crop&q=60'
                },
                segments: allSegments,
                fullText: fullTranscriptText,
                summary,
                keyTakeaways,
                stats: {
                    totalSegments: allSegments.length,
                    wordCount,
                    durationFormatted
                }
            }
        });
    } catch (err) {
        console.error(`[YT Transcribe] Pipeline error on direct audio job ${jobId}:`, err);
        updateJob({
            status: 'failed',
            stage: 'Failed',
            progress: 0,
            message: err.message || 'Direct audio transcription failed.',
            error: err.message
        });
    } finally {
        for (const f of createdTempFiles) {
            try {
                if (fs.existsSync(f)) fs.unlinkSync(f);
            } catch (e) {}
        }
        for (const rem of uploadedGeminiFileNames) {
            try {
                await fileManager.deleteFile(rem);
            } catch (e) {}
        }
    }
}

/**
 * GET /api/youtube-transcribe/cookies-status
 * Check current yt_cookies.txt status (exists, size, last updated, contains youtube cookies)
 */
exports.getCookiesStatus = async (req, res) => {
    try {
        if (!fs.existsSync(COOKIES_PATH)) {
            return res.json({
                exists: false,
                hasYoutube: false,
                hasLogin: false,
                lastModified: null,
                message: 'No cookies file found.'
            });
        }

        const stats = fs.statSync(COOKIES_PATH);
        const content = fs.readFileSync(COOKIES_PATH, 'utf8');
        const hasYoutube = content.includes('.youtube.com') || content.includes('youtube.com');
        const hasLogin = content.includes('LOGIN_INFO') || (content.includes('.youtube.com') && (content.includes('SID') || content.includes('__Secure-1PSID') || content.includes('__Secure-3PSID')));

        return res.json({
            exists: true,
            sizeBytes: stats.size,
            lastModified: stats.mtime,
            hasYoutube,
            hasLogin,
            lineCount: content.split('\n').filter(Boolean).length
        });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

/**
 * POST /api/youtube-transcribe/update-cookies
 * Update yt_cookies.txt via raw text or file upload
 */
exports.updateCookies = async (req, res) => {
    try {
        let cookieText = '';
        if (req.file) {
            cookieText = fs.readFileSync(req.file.path, 'utf8');
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        } else if (req.body?.cookiesText) {
            cookieText = req.body.cookiesText;
        }

        if (!cookieText || typeof cookieText !== 'string' || cookieText.trim().length === 0) {
            return res.status(400).json({ error: 'Please provide valid cookie content.' });
        }

        const trimmed = cookieText.trim();
        // Check if looks like Netscape cookie file
        if (!trimmed.includes('.youtube.com') && !trimmed.includes('.google.com') && !trimmed.includes('# Netscape')) {
            return res.status(400).json({
                error: 'Cookie content does not appear to be a valid Netscape cookie file. Ensure it includes # Netscape HTTP Cookie File or .youtube.com domains.'
            });
        }

        fs.writeFileSync(COOKIES_PATH, trimmed, 'utf8');
        console.log(`[YT Transcribe] yt_cookies.txt updated successfully (${trimmed.length} bytes).`);

        return res.json({
            success: true,
            message: 'YouTube cookies updated successfully!',
            hasYoutube: trimmed.includes('.youtube.com'),
            sizeBytes: trimmed.length
        });
    } catch (e) {
        console.error('[YT Transcribe] Failed to update cookies:', e);
        return res.status(500).json({ error: e.message || 'Failed to update cookies file.' });
    }
};

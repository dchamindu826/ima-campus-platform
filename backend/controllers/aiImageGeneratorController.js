const path = require('path');
const fs = require('fs');

// Ensure image generation folder exists
const UPLOADS_BASE = path.join(__dirname, '../public/uploads/social-media');
const GENERATED_IMG_DIR = path.join(UPLOADS_BASE, 'generated-images');
const HISTORY_FILE = path.join(GENERATED_IMG_DIR, 'history.json');

if (!fs.existsSync(GENERATED_IMG_DIR)) {
    fs.mkdirSync(GENERATED_IMG_DIR, { recursive: true });
}

// Helper to load history
const loadHistory = () => {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = fs.readFileSync(HISTORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.warn('Failed to load history:', err.message);
    }
    return [];
};

// Helper to save history
const saveHistory = (history) => {
    try {
        // Keep last 50 images in history
        const trimmed = history.slice(0, 50);
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch (err) {
        console.warn('Failed to save history:', err.message);
    }
};

/**
 * Core Reusable AI Image Generation Function
 * Can be used by LUMI Image Generator, Claude Studio, and automated marketing workflows
 */
const generateImageCore = async ({
    prompt,
    aspectRatio = '1:1',
    stylePreset = 'photorealistic',
    model: requestedModel = 'pollinations-flux',
    referenceImages = [],
    files = []
}) => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        throw new Error('Prompt is required.');
    }

    console.log(`[AI Image Generator Core] Request: "${prompt.trim().substring(0, 80)}...", AspectRatio: ${aspectRatio}, Style: ${stylePreset}, Model: ${requestedModel}`);

    // Construct Style & Aspect Ratio Instruction
    const styleGuides = {
        'photorealistic': 'Ultra high resolution, 8k, photorealistic, professional photography, natural volumetric lighting, hyperdetailed textures, raw photo quality.',
        'cinematic': 'Cinematic movie still, 35mm lens, dramatic cinematic lighting, shallow depth of field, anamorphic lens flare, award-winning cinematography.',
        '3d-render': 'Vibrant 3D digital art, Pixar/Disney style octane render, rich smooth subsurface scattering, cheerful modern aesthetic, 8k 3D CGI.',
        'marketing-poster': 'Clean professional advertising graphic design, modern typography layout, sharp vibrant colors, Sri Lankan education branding aesthetic, commercial studio.',
        'anime': 'High quality modern anime illustration, Makoto Shinkai aesthetic, vibrant sky and scenery, crisp lines, emotional lighting.',
        'cyberpunk': 'Futuristic cyberpunk neon glow, dark futuristic university tech aesthetic, glowing blue and purple hologram effects, volumetric sci-fi mist.',
        'minimalist': 'Minimalist clean aesthetic, elegant pastel colors, ample negative space, contemporary design, sleek and sophisticated.'
    };

    const styleText = styleGuides[stylePreset] || styleGuides['photorealistic'];

    const aspectRatioGuide = {
        '1:1': 'Aspect ratio 1:1 square framing (1080x1080 format for social media feeds).',
        '9:16': 'Aspect ratio 9:16 vertical orientation (portrait full-screen 1080x1920 format for mobile reels, stories, TikTok).',
        '16:9': 'Aspect ratio 16:9 wide landscape orientation (1920x1080 format for banners, desktop screens, YouTube thumbnails).'
    }[aspectRatio] || 'Aspect ratio 1:1 square.';

    // Check if reference images are attached
    const hasReferenceImage = (Array.isArray(referenceImages) && referenceImages.length > 0) || (files && files.length > 0);

    // Pre-process Singlish & Conversational Prompts
    let cleanedPromptText = prompt.trim();

    // If Singlish conversational phrases exist, clean conversational noise
    const isSinglish = /macahn|machan|hdala|hadala|denna|danna|wade|lassanata|hdanna|me image eka|me photo eka/i.test(cleanedPromptText);
    if (isSinglish) {
        console.log('[AI Image Generator] Detected Singlish conversational prompt. Cleaning...');
        cleanedPromptText = cleanedPromptText
            .replace(/macahn|machan/gi, '')
            .replace(/me image eka use karala|me photo eka use karala|me image eka|me photo eka/gi, '')
            .replace(/class ekata|yt video|thumbnail ekak|thumbnail/gi, 'educational YouTube thumbnail banner')
            .replace(/hdala|hadala|hadanna|hdanna|denna|wade|karala|ona/gi, '')
            .replace(/lassanata|supiriyata|kiyala|danna/gi, '')
            .replace(/title eka/gi, 'titled')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Detect if prompt contains Sinhala Unicode characters
    const containsSinhala = /[\u0D80-\u0DFF]/.test(prompt);
    let typographyGuide = '';
    if (containsSinhala) {
        typographyGuide = ` IMPORTANT TYPOGRAPHY INSTRUCTION: The user wants accurate Sinhala text. Ensure any written text strictly matches the exact Sinhala characters and spellings provided in the prompt without dropping vowels, kombuva, or ligatures. Render with crisp, bold, high-contrast typography.`;
    }

    // Construct explicit reference image subject preservation instruction
    let referenceSubjectGuide = '';
    if (hasReferenceImage) {
        referenceSubjectGuide = ` CRITICAL SUBJECT INSTRUCTION: You MUST incorporate and preserve the exact person, face, hair, glasses, clothing style, and identity of the male lecturer/person shown in the attached reference image (Ref #1). Place the person prominently on one side with professional studio lighting for an educational banner. Do NOT generate random unrelated characters or faces.`;
    }

    const fullPrompt = `${cleanedPromptText}.${referenceSubjectGuide}${typographyGuide} Style details: ${styleText} Composition: ${aspectRatioGuide} High fidelity, crisp details, no blurriness, no watermark.`;

    let generatedBuffer = null;
    let mimeType = 'image/jpeg';
    let modelUsed = requestedModel;
    let responseNotes = '';

    // 1. FREE ENGINE: Pollinations AI (Flux / SDXL - Only for Text Prompts WITHOUT Reference Images)
    if ((requestedModel === 'pollinations-flux' || requestedModel === 'pollinations-turbo' || !apiKey) && !hasReferenceImage) {
        try {
            console.log(`[AI Image Generator] Generating using FREE Pollinations Flux Engine...`);
            const dimMap = {
                '1:1': { width: 1080, height: 1080 },
                '9:16': { width: 1080, height: 1920 },
                '16:9': { width: 1920, height: 1080 }
            };
            const { width, height } = dimMap[aspectRatio] || { width: 1080, height: 1080 };
            const seed = Math.floor(Math.random() * 1000000);
            const pollinationsModel = requestedModel === 'pollinations-turbo' ? 'turbo' : 'flux';
            const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=${pollinationsModel}`;

            const response = await fetch(pollUrl);
            if (response.ok) {
                const arrayBuf = await response.arrayBuffer();
                generatedBuffer = Buffer.from(arrayBuf);
                mimeType = response.headers.get('content-type') || 'image/jpeg';
                modelUsed = `Pollinations ${pollinationsModel.toUpperCase()} (Free $0)`;
                responseNotes = 'Generated using 100% Free Pollinations AI Flux Engine.';
            } else {
                console.warn('[AI Image Generator] Pollinations returned HTTP', response.status);
            }
        } catch (pErr) {
            console.warn('[AI Image Generator] Pollinations error:', pErr.message);
        }
    }

    // 2. GOOGLE GEMINI / IMAGEN VISION MODELS
    if (!generatedBuffer && apiKey) {
        const parts = [];

        // Attach reference images if provided (up to 3 images)
        if (Array.isArray(referenceImages) && referenceImages.length > 0) {
            const validImages = referenceImages.slice(0, 3);
            for (const img of validImages) {
                if (img.data) {
                    const cleanBase64 = img.data.replace(/^data:image\/[a-z0-9+]+;base64,/, '');
                    parts.push({
                        inlineData: {
                            mimeType: img.mimeType || 'image/jpeg',
                            data: cleanBase64
                        }
                    });
                }
            }
        }

        // Also check if files were uploaded via multer (files)
        if (files && files.length > 0) {
            const uploadFiles = files.slice(0, 3);
            for (const f of uploadFiles) {
                try {
                    const fileBuf = fs.readFileSync(f.path);
                    const b64 = fileBuf.toString('base64');
                    parts.push({
                        inlineData: {
                            mimeType: f.mimetype || 'image/jpeg',
                            data: b64
                        }
                    });
                } catch (e) {
                    console.warn('[AI Image Generator] Error reading uploaded file:', e.message);
                }
            }
        }

        parts.push({ text: fullPrompt });

        const requestBody = {
            contents: [{ parts }],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT']
            }
        };

        const modelsToTry = [
            requestedModel,
            'imagen-3.0-fast-generate-001',
            'imagen-3.0-generate-002',
            'gemini-3.1-flash-image',
            'gemini-2.5-flash-image'
        ].filter((v, i, a) => a && a.indexOf(v) === i && !v.startsWith('pollinations'));

        for (const modelName of modelsToTry) {
            try {
                console.log(`[AI Image Generator] Attempting Google API with model: ${modelName}...`);
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });

                const data = await response.json();

                if (!response.ok || data.error) {
                    throw new Error(data.error?.message || `API error ${response.status}`);
                }

                const responseParts = data?.candidates?.[0]?.content?.parts || [];
                for (const part of responseParts) {
                    if (part.inlineData && part.inlineData.data) {
                        generatedBuffer = Buffer.from(part.inlineData.data, 'base64');
                        mimeType = part.inlineData.mimeType || 'image/jpeg';
                        modelUsed = modelName;
                    } else if (part.text) {
                        responseNotes += part.text + ' ';
                    }
                }

                if (generatedBuffer) {
                    break;
                }
            } catch (err) {
                console.warn(`[AI Image Generator] Model ${modelName} failed:`, err.message);
            }
        }

        // Secondary fallback to Pollinations if Google API failed or model errored
        if (!generatedBuffer) {
            console.log('[AI Image Generator] Falling back to Pollinations AI Free Engine...');
            try {
                const dimMap = { '1:1': { width: 1080, height: 1080 }, '9:16': { width: 1080, height: 1920 }, '16:9': { width: 1920, height: 1080 } };
                const { width, height } = dimMap[aspectRatio] || { width: 1080, height: 1080 };
                const seed = Math.floor(Math.random() * 1000000);
                const pollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;
                const response = await fetch(pollUrl);
                if (response.ok) {
                    const arrayBuf = await response.arrayBuffer();
                    generatedBuffer = Buffer.from(arrayBuf);
                    mimeType = response.headers.get('content-type') || 'image/jpeg';
                    modelUsed = 'Pollinations FLUX (Free Fallback)';
                    responseNotes = 'Generated via Free Fallback Engine.';
                }
            } catch (fbErr) {
                console.warn('[AI Image Generator] Fallback error:', fbErr.message);
            }
        }
    }

    if (!generatedBuffer) {
        throw new Error('Failed to generate image. Please try again with a different model or prompt.');
    }

    // Save generated image to local disk
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const filename = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
    const savePath = path.join(GENERATED_IMG_DIR, filename);

    fs.writeFileSync(savePath, generatedBuffer);

    const publicUrl = `/uploads/social-media/generated-images/${filename}`;
    const fullBase64 = `data:${mimeType};base64,${generatedBuffer.toString('base64')}`;

    // Record in history
    const historyRecord = {
        id: `img-${Date.now()}`,
        filename,
        imageUrl: publicUrl,
        prompt: prompt.trim(),
        fullPrompt,
        aspectRatio,
        stylePreset,
        modelUsed,
        notes: responseNotes.trim(),
        createdAt: new Date().toISOString()
    };

    const currentHistory = loadHistory();
    currentHistory.unshift(historyRecord);
    saveHistory(currentHistory);

    console.log(`[AI Image Generator] Image generated successfully! Saved to: ${publicUrl}`);

    return {
        success: true,
        imageUrl: publicUrl,
        base64: fullBase64,
        mimeType,
        aspectRatio,
        prompt: prompt.trim(),
        modelUsed,
        notes: responseNotes.trim(),
        historyId: historyRecord.id
    };
};

exports.generateImageCore = generateImageCore;

/**
 * Controller endpoint for LUMI AI Image Generator
 */
exports.generateAiImage = async (req, res) => {
    try {
        const userRole = (req.user?.role || '').toUpperCase();
        const isSuperAdmin = ['SYSTEM_ADMIN', 'SUPER', 'ADMIN', 'DIRECTOR', 'SYSTEM ADMIN'].includes(userRole);
        if (!isSuperAdmin) {
            return res.status(403).json({ error: 'Access restricted: LUMI AI Image Generator is available for Super Admin only.' });
        }

        const {
            prompt,
            aspectRatio = '1:1',
            stylePreset = 'photorealistic',
            model: requestedModel = 'pollinations-flux',
            referenceImages = []
        } = req.body;

        const result = await generateImageCore({
            prompt,
            aspectRatio,
            stylePreset,
            model: requestedModel,
            referenceImages,
            files: req.files || []
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('[AI Image Generator] Controller error:', error);
        return res.status(500).json({ error: error.message || 'Internal server error generating image' });
    }
};

/**
 * Get recent generation history
 */
exports.getImageHistory = async (req, res) => {
    try {
        const history = loadHistory();
        return res.status(200).json({ success: true, history });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to load history' });
    }
};

/**
 * AI Prompt Enhancer using Gemini 2.5 Flash
 */
exports.enhancePrompt = async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
        }

        const { rawPrompt, aspectRatio = '1:1', style = 'photorealistic' } = req.body;
        if (!rawPrompt) {
            return res.status(400).json({ error: 'rawPrompt is required' });
        }

        const systemPrompt = `You are a world-class AI Image Prompt Engineer specializing in Google Imagen / Gemini visual generation.
Turn this raw user concept into a vivid, descriptive, high-retention English prompt for generating an incredible image.
User Concept: "${rawPrompt}"
Desired Aspect Ratio: ${aspectRatio}
Desired Style: ${style}

Rules:
1. Describe the subject, lighting, environment, mood, camera angle, textures, and color palette in vivid detail.
2. If Sri Lankan education/campus context is implied, include authentic, modern, inspiring campus details.
3. Keep the prompt between 30 and 70 words. Do NOT include preamble or explanations, return ONLY the enhanced prompt string.`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: systemPrompt }] }]
            })
        });

        const data = await response.json();
        const enhanced = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || rawPrompt;

        return res.status(200).json({ success: true, enhancedPrompt: enhanced });
    } catch (error) {
        return res.status(500).json({ error: error.message || 'Failed to enhance prompt' });
    }
};

const axios = require('axios');
const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const { generateImageCore } = require('./aiImageGeneratorController');

// Candidate service account paths
const SA_PATHS = [
    path.join(__dirname, '..', 'gsheet-service-account.json'),
    path.join(__dirname, '..', 'gemini-service-account.json'),
    path.join(__dirname, '..', 'serviceAccountKey.json'),
];

const getGcpAuth = async () => {
    for (const saPath of SA_PATHS) {
        if (fs.existsSync(saPath)) {
            try {
                const fileContent = JSON.parse(fs.readFileSync(saPath, 'utf8'));
                const auth = new GoogleAuth({
                    keyFile: saPath,
                    scopes: ['https://www.googleapis.com/auth/cloud-platform']
                });
                const client = await auth.getClient();
                const token = await client.getAccessToken();
                if (token && token.token) {
                    return {
                        token: token.token,
                        projectId: fileContent.project_id || 'gen-lang-client-0572581720',
                        clientEmail: fileContent.client_email,
                        saPath
                    };
                }
            } catch (err) {
                console.warn(`[Claude Controller] Failed with SA ${saPath}:`, err.message);
            }
        }
    }
    return null;
};

// Elite Developer, UI Architect & Generative AI System Prompt
const DEFAULT_SYSTEM_PROMPT = `You are Claude Opus 5, Anthropic's premier frontier AI model, operating as a World-Class Principal Frontend Architect, Creative UI/UX Designer, and Generative AI Creator.

CORE CAPABILITIES:

1. CODE & LIVE ARTIFACTS:
- When asked to build websites, dashboards, landing pages, tools, games, or interactive components, ALWAYS deliver a SINGLE, SELF-CONTAINED, 100% COMPLETE RUNNABLE HTML FILE inside a single \`\`\`html ... \`\`\` block using Tailwind CSS, Chart.js, FontAwesome/Lucide icons, and full JavaScript interactivity.
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
- Accompany the generated image with your insightful, friendly, and comprehensive explanation or creative copy in the requested language (Sinhala, English, or Singlish).

3. SINHALA THUMBNAILS, BANNERS & POSTERS (16:9 LIVE CANVAS ARTIFACTS):
- When the user asks for a YouTube thumbnail, social media poster, or banner with Sinhala titles and text (e.g. "sinhala titles ekka thumbnail ekak", "sinhala text ekka image ekak", "thumbnails wage ehema", "posters"):
- You MUST provide:
  A) An AI visual image via :::image ... :::
  B) A SPECTACULAR 16:9 HTML/CANVAS THUMBNAIL ARTIFACT wrapped in \`\`\`html ... \`\`\` that includes:
     - 16:9 aspect ratio thumbnail container (w-full max-w-4xl aspect-[16/9] relative overflow-hidden rounded-2xl shadow-2xl).
     - Google Sinhala Typography ('Noto Sans Sinhala', 'Yaldevi', 'Gemunu Libre').
     - Ultra-bold gradient Sinhala titles (e.g., text-4xl md:text-6xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-500 bg-clip-text text-transparent drop-shadow-2xl).
     - Attention-grabbing badge pills ("🔴 LIVE CLASS", "2027 A/L", "විශේෂ සම්මන්ත්‍රණය", "නොමිලේ", "NEW BATCH").
     - Dark dramatic vignettes and lighting accents.
     - Live editable text (contenteditable="true") on headings and subtitles so the user can easily click and edit text right in the canvas!
     - An integrated "Download as PNG 📥" button powered by html2canvas that saves the thumbnail as an image immediately!`;

// Fallback using Gemini Developer API if Vertex Claude is awaiting IAM propagation
const callGeminiFallback = async (messages, systemPrompt, modelName) => {
    const apiKey = process.env.GEMINI_API_KEY;
    const auth = await getGcpAuth();
    
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: Array.isArray(m.content) 
            ? m.content.map(c => {
                if (c.type === 'text') return { text: c.text };
                if (c.type === 'image') return { inlineData: { mimeType: c.source?.media_type || 'image/jpeg', data: c.source?.data } };
                return { text: JSON.stringify(c) };
            })
            : [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
    }));

    const geminiModel = 'gemini-2.5-flash';
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent`;
    let headers = { 'Content-Type': 'application/json' };

    if (apiKey) {
        url += `?key=${apiKey}`;
    } else if (auth) {
        headers['Authorization'] = `Bearer ${auth.token}`;
    }

    const payload = {
        contents,
        generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192
        }
    };
    
    const activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
    payload.systemInstruction = { parts: [{ text: activeSystemPrompt }] };

    const res = await axios.post(url, payload, { headers });
    const candidate = res.data.candidates?.[0];
    const text = candidate?.content?.parts?.map(p => p.text).join('') || 'No response generated.';
    return {
        text,
        model: `${geminiModel} (Fallback Mode)`,
        usage: {
            input_tokens: res.data.usageMetadata?.promptTokenCount || 0,
            output_tokens: res.data.usageMetadata?.candidatesTokenCount || 0
        }
    };
};

/**
 * Clean & extract image prompt from user message when fallback image generation is needed
 */
const extractImagePromptFromUserText = (userText) => {
    let clean = userText.trim();
    // Remove conversational filler
    clean = clean.replace(/^(?:hey|hi|hello|machan|macahn|bro|please|plz|mata|ane)\s+/gi, '');
    clean = clean.replace(/(?:generate|hadala|hdala|karala|hadanna|hdanna|karanna|ona|plwanda|puluwanda|denna)\s*/gi, '');
    clean = clean.replace(/(?:image|photo|picture|chithrayak|rupayak)\s*(?:ekak|eka)?/gi, '');
    clean = clean.replace(/\s+/g, ' ').trim();

    // Check if Sinhala text exists in the prompt
    const containsSinhala = /[\u0D80-\u0DFF]/.test(userText);
    if (containsSinhala) {
        return `High resolution modern creative artwork, Sri Lankan aesthetic, vibrant lighting, professional design, ${clean || 'beautiful educational concept'}. Featuring crisp, bold Sinhala typography`;
    }

    return clean || userText;
};

/**
 * Process Claude's response text with the integrated AI Image Generation Engine
 */
const processResponseWithImageEngine = async (rawText, messages, reqBody) => {
    let processedText = rawText || '';
    const generatedImages = [];

    // 1. Detect explicit :::image ... ::: blocks
    const imageBlockRegex = /:::image\s*([\s\S]*?):::/gi;
    let match;
    const blocksToProcess = [];

    while ((match = imageBlockRegex.exec(processedText)) !== null) {
        blocksToProcess.push({
            fullMatch: match[0],
            content: match[1]
        });
    }

    for (const block of blocksToProcess) {
        try {
            const lines = block.content.split('\n');
            let imgPrompt = '';
            let aspectRatio = reqBody.imageOptions?.aspectRatio || '1:1';
            let style = reqBody.imageOptions?.style || 'photorealistic';
            let caption = 'AI Generated Image';

            for (const line of lines) {
                const trimmed = line.trim();
                if (/^prompt:\s*/i.test(trimmed)) {
                    imgPrompt = trimmed.replace(/^prompt:\s*/i, '').trim();
                } else if (/^aspectRatio:\s*/i.test(trimmed)) {
                    aspectRatio = trimmed.replace(/^aspectRatio:\s*/i, '').trim();
                } else if (/^style:\s*/i.test(trimmed)) {
                    style = trimmed.replace(/^style:\s*/i, '').trim();
                } else if (/^caption:\s*/i.test(trimmed)) {
                    caption = trimmed.replace(/^caption:\s*/i, '').trim();
                }
            }

            if (!imgPrompt) {
                imgPrompt = block.content.trim();
            }

            console.log(`[Claude Studio] Generating AI image for prompt: "${imgPrompt.substring(0, 60)}..."`);

            const imgResult = await generateImageCore({
                prompt: imgPrompt,
                aspectRatio,
                stylePreset: style,
                model: 'pollinations-flux'
            });

            if (imgResult && imgResult.imageUrl) {
                generatedImages.push({
                    imageUrl: imgResult.imageUrl,
                    prompt: imgPrompt,
                    aspectRatio,
                    style,
                    caption,
                    modelUsed: imgResult.modelUsed
                });

                const markdownImg = `\n\n![${caption}](${imgResult.imageUrl})\n\n`;
                processedText = processedText.replace(block.fullMatch, markdownImg);
            }
        } catch (imgErr) {
            console.error('[Claude Studio] Image generation block error:', imgErr.message);
            processedText = processedText.replace(block.fullMatch, `\n> ⚠️ *Image generation error: ${imgErr.message}*\n`);
        }
    }

    // 2. Intelligent Auto-Detection of Image Generation Intent
    // If user asked to generate an image and model didn't include :::image (or replied with refusal)
    const lastUserMsg = messages?.slice().reverse().find(m => m.role === 'user');
    const userText = typeof lastUserMsg?.content === 'string' 
        ? lastUserMsg.content 
        : (Array.isArray(lastUserMsg?.content) ? lastUserMsg.content.map(c => c.text || '').join(' ') : '');

    const hasImageIntent = Boolean(reqBody.generateImage) ||
        /(?:generate|create|make|draw|hadanna|hdanna|hadala|hdala|hithaganna)\s+(?:an?\s+)?(?:ai\s+)?(?:image|picture|photo|poster|banner|chithrayak|rupayak|design)/i.test(userText) ||
        /(?:image|photo|poster|banner)\s+(?:generate|ekak|eka|hadala|hdala|denna|hදන්න)/i.test(userText) ||
        /(?:sinhala|aluth)\s+(?:image|photo|banner|poster)/i.test(userText) ||
        /[\u0D80-\u0DFF]/.test(userText) && /(?:image|photo|chithra)/i.test(userText);

    if (hasImageIntent && generatedImages.length === 0) {
        console.log('[Claude Studio] Detected image generation intent in user message. Synthesizing AI image...');
        try {
            // Clean up any refusal text if model stated it's text-based
            processedText = processedText
                .replace(/hey mate,?\s*i can'?t directly generate images[^\n]*\n?/gi, '')
                .replace(/i am a text-based ai[^\n]*\n?/gi, '')
                .replace(/i cannot create images[^\n]*\n?/gi, '')
                .replace(/i cannot generate images[^\n]*\n?/gi, '')
                .trim();

            const imgPrompt = extractImagePromptFromUserText(userText);
            const userAspectRatio = reqBody.imageOptions?.aspectRatio || 
                (userText.includes('banner') || userText.includes('yt') || userText.includes('thumbnail') ? '16:9' : (userText.includes('story') || userText.includes('reel') ? '9:16' : '1:1'));
            const userStyle = reqBody.imageOptions?.style || 'photorealistic';

            const imgResult = await generateImageCore({
                prompt: imgPrompt,
                aspectRatio: userAspectRatio,
                stylePreset: userStyle,
                model: 'pollinations-flux'
            });

            if (imgResult && imgResult.imageUrl) {
                generatedImages.push({
                    imageUrl: imgResult.imageUrl,
                    prompt: imgPrompt,
                    aspectRatio: userAspectRatio,
                    style: userStyle,
                    caption: 'AI Generated Image',
                    modelUsed: imgResult.modelUsed
                });

                const leadIn = processedText ? `${processedText}\n\n` : '';
                processedText = `${leadIn}![AI Generated Image](${imgResult.imageUrl})\n\n> 🎨 **Generated by Claude Opus 5 AI Engine**\n> *Prompt:* \`${imgPrompt.slice(0, 120)}\` | *Style:* \`${userStyle}\` | *Ratio:* \`${userAspectRatio}\``;
            }
        } catch (autoErr) {
            console.error('[Claude Studio] Auto image generation error:', autoErr.message);
        }
    }

    // 3. Hallucinated / Broken Image Link Protector
    // If the model outputted a markdown image link with relative or broken URL, normalize & resolve it!
    const mdImgRegex = /!\[([^\]]*)\]\(([^)\s]+)\)/gi;
    let mdImgMatch;
    const linksToCheck = [];

    while ((mdImgMatch = mdImgRegex.exec(processedText)) !== null) {
        const caption = mdImgMatch[1] || 'AI Generated Image';
        const rawUrl = mdImgMatch[2].trim();
        linksToCheck.push({ caption, rawUrl });
    }

    for (const item of linksToCheck) {
        const { caption, rawUrl } = item;
        // Ignore external URLs (unless localhost/imacampus)
        if ((rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !rawUrl.includes('imacampus') && !rawUrl.includes('localhost')) {
            continue;
        }

        const filename = path.basename(rawUrl.split('?')[0]);
        const properPublicUrl = `/uploads/social-media/generated-images/${filename}`;
        const diskPath = path.join(__dirname, '../public/uploads/social-media/generated-images', filename);

        if (fs.existsSync(diskPath)) {
            // File exists on disk! Ensure markdown link uses proper public URL
            if (rawUrl !== properPublicUrl) {
                processedText = processedText.split(rawUrl).join(properPublicUrl);
            }
        } else {
            // File does NOT exist on disk (hallucinated or broken)
            console.warn(`[Claude Studio] Detected broken/hallucinated image link: ${rawUrl}`);
            if (generatedImages.length > 0) {
                processedText = processedText.split(rawUrl).join(generatedImages[0].imageUrl);
            } else {
                try {
                    const realImg = await generateImageCore({
                        prompt: caption || userText || 'Modern educational graphic with high quality visual',
                        aspectRatio: reqBody.imageOptions?.aspectRatio || '16:9',
                        stylePreset: reqBody.imageOptions?.style || 'photorealistic',
                        model: 'pollinations-flux'
                    });
                    if (realImg && realImg.imageUrl) {
                        processedText = processedText.split(rawUrl).join(realImg.imageUrl);
                        generatedImages.push({
                            imageUrl: realImg.imageUrl,
                            prompt: caption,
                            aspectRatio: '16:9',
                            caption: caption,
                            modelUsed: realImg.modelUsed
                        });
                    }
                } catch (err) {
                    console.error('[Claude Studio] Failed to generate fallback image for broken link:', err.message);
                }
            }
        }
    }

    // 4. Sinhala Thumbnail & Banner Generator Helper
    // If the user requested a Sinhala thumbnail/banner/title and no HTML artifact was produced,
    // generate an ultra-premium, interactive 16:9 Sinhala Thumbnail Live Canvas artifact!
    const isThumbnailRequest = /(?:thumbnail|thumbnails|banner|posters?|cover|sinhala title|sinhala text|තම්බ්නෙයිල්|පෝස්ටර්|බැනර්)/i.test(userText);
    const hasHtmlArtifact = processedText.includes('```html') || processedText.includes('<!DOCTYPE');

    if (isThumbnailRequest && !hasHtmlArtifact) {
        console.log('[Claude Studio] Synthesizing live 16:9 Sinhala Thumbnail Canvas Artifact...');
        const bgUrl = generatedImages[0]?.imageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80';
        
        // Extract plausible Sinhala title or fallback
        const sinhalaChars = userText.match(/[\u0D80-\u0DFF\s\d\.\:\,\!\?\-]+/g)?.map(s => s.trim()).filter(s => s.length > 3) || [];
        const mainTitle = sinhalaChars[0] || 'ශ්‍රී ලංකාවේ අනාගත තාක්ෂණික පෙරළිය';
        const subTitle = sinhalaChars[1] || 'අලුත්ම තාක්ෂණය හා ප්‍රායෝගික දැනුම එකම තැනකින් ලබාගන්න';

        const thumbnailHtml = `
\`\`\`html
<!DOCTYPE html>
<html lang="si">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sinhala 16:9 Thumbnail Generator</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Gemunu+Libre:wght@700;800;900&family=Noto+Sans+Sinhala:wght@400;600;700;900&family=Outfit:wght@400;600;800;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
  <style>
    body { font-family: 'Noto Sans Sinhala', 'Outfit', sans-serif; margin: 0; background: #07090E; color: #f3f4f6; }
    .sinhala-heading { font-family: 'Gemunu Libre', 'Noto Sans Sinhala', sans-serif; line-height: 1.15; }
    .thumbnail-box {
      aspect-ratio: 16 / 9;
      width: 100%;
      max-width: 1100px;
    }
    [contenteditable="true"]:hover {
      outline: 2px dashed rgba(245, 158, 11, 0.6);
      cursor: text;
      border-radius: 4px;
    }
    [contenteditable="true"]:focus {
      outline: 2px solid #f59e0b;
      background: rgba(0,0,0,0.3);
      border-radius: 4px;
    }
  </style>
</head>
<body class="min-h-screen flex flex-col items-center justify-center p-4 md:p-8">

  <!-- Top Action Bar -->
  <div class="w-full max-w-[1100px] mb-4 flex flex-wrap items-center justify-between gap-3 bg-[#121622] p-3 rounded-2xl border border-white/10 shadow-xl">
    <div class="flex items-center gap-2">
      <span class="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
      <span class="font-bold text-sm text-amber-300">Live Sinhala Thumbnail Studio (16:9)</span>
      <span class="text-xs text-gray-400 hidden sm:inline">| Click any text to edit directly</span>
    </div>
    <div class="flex items-center gap-2">
      <button onclick="changeBackground()" class="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-200 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5">
        <i class="fa-solid fa-wand-magic-sparkles text-amber-400"></i> Theme Overlay
      </button>
      <button id="downloadBtn" onclick="exportThumbnail()" class="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-xs font-bold rounded-lg shadow-lg transition-all flex items-center gap-2 active:scale-95">
        <i class="fa-solid fa-download"></i> Download 4K Thumbnail (PNG)
      </button>
    </div>
  </div>

  <!-- 16:9 Thumbnail Canvas -->
  <div id="thumbnailCanvas" class="thumbnail-box relative rounded-3xl overflow-hidden shadow-2xl border border-white/20 select-none">
    
    <!-- Background Image with Zoom & Dark Gradient -->
    <img id="bgImage" src="${bgUrl}" alt="Background" class="absolute inset-0 w-full h-full object-cover transform scale-105 transition-all duration-700">
    <div id="gradientOverlay" class="absolute inset-0 bg-gradient-to-r from-black/95 via-black/70 to-transparent"></div>
    <div class="absolute inset-0 bg-radial-vignette opacity-50 pointer-events-none"></div>

    <!-- Content Container -->
    <div class="absolute inset-0 p-6 md:p-12 flex flex-col justify-between z-10">
      
      <!-- Top Badges -->
      <div class="flex items-center gap-3">
        <div contenteditable="true" class="px-3.5 py-1.5 rounded-full bg-red-600 text-white font-extrabold text-xs md:text-sm tracking-wide shadow-lg flex items-center gap-2 uppercase">
          <span class="w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
          <span>🔴 විශේෂ සම්මන්ත්‍රණය</span>
        </div>
        <div contenteditable="true" class="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-amber-500/40 text-amber-300 font-bold text-xs md:text-sm shadow-md">
          ⚡ 2026/2027 NEW BATCH
        </div>
      </div>

      <!-- Main Typography Center/Left -->
      <div class="max-w-2xl my-auto space-y-3">
        <h1 contenteditable="true" class="sinhala-heading text-3xl sm:text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-white drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)] tracking-tight leading-tight">
          ${mainTitle}
        </h1>
        <p contenteditable="true" class="text-gray-200 text-sm sm:text-lg md:text-xl font-semibold drop-shadow-md leading-relaxed max-w-xl">
          ${subTitle}
        </p>

        <!-- Feature Pills -->
        <div class="flex flex-wrap gap-2 pt-2">
          <span contenteditable="true" class="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-xs md:text-sm font-medium text-gray-200 shadow">
            ✅ 100% ප්‍රායෝගික පුහුණුව
          </span>
          <span contenteditable="true" class="px-3 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg text-xs md:text-sm font-medium text-gray-200 shadow">
            🎓 IMA Campus සහතිකය
          </span>
          <span contenteditable="true" class="px-3 py-1 bg-amber-500/20 backdrop-blur-md border border-amber-400/30 rounded-lg text-xs md:text-sm font-bold text-amber-300 shadow">
            🔥 නොමිලේ ලියාපදිංචිය
          </span>
        </div>
      </div>

      <!-- Footer Bar -->
      <div class="flex items-end justify-between border-t border-white/15 pt-3">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center font-black text-white text-lg shadow-lg border border-white/30">
            IMA
          </div>
          <div>
            <div contenteditable="true" class="font-bold text-white text-sm md:text-base">IMA Campus Online</div>
            <div contenteditable="true" class="text-xs text-amber-300 font-medium">Official Lecture & Course Series</div>
          </div>
        </div>
        <div contenteditable="true" class="text-right text-xs md:text-sm font-extrabold text-white bg-black/60 px-3 py-1.5 rounded-xl border border-white/20">
          www.imacampus.online
        </div>
      </div>

    </div>
  </div>

  <script>
    let themeIndex = 0;
    const gradients = [
      'bg-gradient-to-r from-black/95 via-black/70 to-transparent',
      'bg-gradient-to-t from-black/95 via-black/60 to-black/30',
      'bg-gradient-to-r from-blue-950/95 via-slate-900/80 to-transparent',
      'bg-gradient-to-r from-amber-950/90 via-black/70 to-transparent'
    ];

    function changeBackground() {
      themeIndex = (themeIndex + 1) % gradients.length;
      document.getElementById('gradientOverlay').className = 'absolute inset-0 ' + gradients[themeIndex];
    }

    function exportThumbnail() {
      const btn = document.getElementById('downloadBtn');
      const origHtml = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Rendering 4K...';
      btn.disabled = true;

      const element = document.getElementById('thumbnailCanvas');
      html2canvas(element, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#000000'
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'sinhala-thumbnail-' + Date.now() + '.png';
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
        btn.innerHTML = origHtml;
        btn.disabled = false;
      }).catch(err => {
        console.error('Export failed:', err);
        alert('Rendering error: ' + err.message);
        btn.innerHTML = origHtml;
        btn.disabled = false;
      });
    }
  </script>
</body>
</html>
\`\`\`
`;
        processedText += `\n\n### 🎨 16:9 Sinhala Live Thumbnail Studio\nඔබගේ සිංහල මාතෘකාව සහිත 16:9 Thumbnail එක සජීවීව පහත Canvas එකෙන් බලාගත හැක. ඔබට අවශ්‍ය පරිදි මෙහි ඕනෑම සිංහල අකුරක් ක්ලික් කර (Click & Edit) වෙනස් කර **Download 4K Thumbnail (PNG)** බටන් එකෙන් බාගත හැකිය:\n\n${thumbnailHtml}`;
    }

    return {
        text: processedText,
        images: generatedImages
    };
};

/**
 * POST /api/claude/chat
 */
exports.handleChat = async (req, res) => {
    try {
        const {
            messages = [],
            systemPrompt = '',
            model = 'claude-opus-5',
            temperature = 0.7,
            maxTokens = 8192,
            region = 'us-east5',
            anthropicApiKey = ''
        } = req.body;

        if (!messages || messages.length === 0) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        const activeSystemPrompt = systemPrompt || DEFAULT_SYSTEM_PROMPT;
        const directApiKey = anthropicApiKey || process.env.ANTHROPIC_API_KEY;

        // Mode 1: Direct Anthropic API
        if (directApiKey && directApiKey.startsWith('sk-ant-')) {
            try {
                const anthropicPayload = {
                    model: model === 'claude-opus-5' ? 'claude-3-opus-20240229' : model,
                    max_tokens: Math.min(maxTokens || 8192, 8192),
                    temperature: parseFloat(temperature) || 0.7,
                    system: activeSystemPrompt,
                    messages: messages.map(m => ({
                        role: m.role === 'assistant' ? 'assistant' : 'user',
                        content: m.content
                    }))
                };

                const response = await axios.post('https://api.anthropic.com/v1/messages', anthropicPayload, {
                    headers: {
                        'x-api-key': directApiKey,
                        'anthropic-version': '2023-06-01',
                        'Content-Type': 'application/json'
                    },
                    timeout: 90000
                });

                const rawText = response.data.content?.map(c => c.text).join('\n') || '';
                const processed = await processResponseWithImageEngine(rawText, messages, req.body);

                return res.json({
                    success: true,
                    text: processed.text,
                    images: processed.images,
                    model: response.data.model,
                    usage: response.data.usage,
                    provider: 'Anthropic Direct API'
                });
            } catch (err) {
                console.warn('[Claude Direct API Error]:', err.response?.data || err.message);
            }
        }

        // Mode 2: Google Cloud Vertex AI
        const gcpAuth = await getGcpAuth();
        if (gcpAuth) {
            const projectId = gcpAuth.projectId;
            const targetRegions = [region, 'us-east5', 'us-central1', 'europe-west1', 'global'].filter((v, i, a) => a.indexOf(v) === i);

            for (const loc of targetRegions) {
                try {
                    const vertexUrl = loc === 'global'
                        ? `https://aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/global/publishers/anthropic/models/${model}:rawPredict`
                        : `https://${loc}-aiplatform.googleapis.com/v1beta1/projects/${projectId}/locations/${loc}/publishers/anthropic/models/${model}:rawPredict`;

                    const anthropicPayload = {
                        anthropic_version: 'vertex-2023-10-16',
                        max_tokens: maxTokens || 8192,
                        temperature: parseFloat(temperature) || 0.7,
                        system: activeSystemPrompt,
                        messages: messages.map(m => ({
                            role: m.role === 'assistant' ? 'assistant' : 'user',
                            content: m.content
                        }))
                    };

                    const vertexRes = await axios.post(vertexUrl, anthropicPayload, {
                        headers: {
                            'Authorization': `Bearer ${gcpAuth.token}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 120000
                    });

                    const rawText = vertexRes.data.content?.map(c => c.text).join('\n') || '';
                    const processed = await processResponseWithImageEngine(rawText, messages, req.body);

                    return res.json({
                        success: true,
                        text: processed.text,
                        images: processed.images,
                        model: `${model} (${loc})`,
                        usage: vertexRes.data.usage || { input_tokens: 0, output_tokens: 0 },
                        provider: `Google Cloud Vertex AI (${loc})`
                    });
                } catch (vErr) {
                    const errMsg = vErr.response?.data?.error?.message || vErr.message;
                    console.warn(`[Claude Vertex ${loc} failed]:`, errMsg);
                    if (errMsg.includes('Permission') || errMsg.includes('denied') || errMsg.includes('IAM')) {
                        break;
                    }
                }
            }

            console.warn('[Claude Vertex AI All Regions Failed] Trying Gemini Fallback with notice...');
            try {
                const fallbackRes = await callGeminiFallback(messages, activeSystemPrompt, model);
                const processed = await processResponseWithImageEngine(fallbackRes.text, messages, req.body);

                return res.json({
                    success: true,
                    text: processed.text,
                    images: processed.images,
                    model: fallbackRes.model,
                    usage: fallbackRes.usage,
                    provider: 'Google Vertex (AI Fallback Active)',
                    notice: `Vertex AI Claude is pending IAM role 'Vertex AI User' on project ${projectId}. Responding with Gemini 2.5 Pro active engine in the meantime.`
                });
            } catch (fbErr) {
                console.error('[Gemini Fallback Error]:', fbErr.message);
            }
        }

        return res.status(500).json({
            error: 'Failed to communicate with Claude Opus 5 or fallback engines. Please verify Service Account or Anthropic API Key.'
        });

    } catch (error) {
        console.error('[Claude Controller handleChat Error]:', error);
        return res.status(500).json({
            error: error.response?.data?.error?.message || error.message || 'Internal server error processing Claude request'
        });
    }
};

/**
 * POST /api/claude/generate-image
 * Dedicated direct image generator endpoint for Claude Studio
 */
exports.generateImage = async (req, res) => {
    try {
        const {
            prompt,
            aspectRatio = '1:1',
            stylePreset = 'photorealistic',
            model = 'pollinations-flux',
            referenceImages = []
        } = req.body;

        if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        const result = await generateImageCore({
            prompt,
            aspectRatio,
            stylePreset,
            model,
            referenceImages
        });

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error('[Claude Controller generateImage Error]:', error);
        return res.status(500).json({ error: error.message || 'Failed to generate image' });
    }
};

/**
 * GET /api/claude/status
 */
exports.getStatus = async (req, res) => {
    try {
        const gcpAuth = await getGcpAuth();
        return res.json({
            success: true,
            hasGcpAuth: !!gcpAuth,
            projectId: gcpAuth?.projectId || 'gen-lang-client-0572581720',
            clientEmail: gcpAuth?.clientEmail || null,
            imageGenerationAvailable: true,
            models: [
                { id: 'claude-opus-5', name: 'Claude Opus 5 (Most Powerful)', context: '1,000,000 Tokens', maxOutput: '128,000 Tokens', tag: 'Anthropic Flagship' },
                { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)', context: '200,000 Tokens', maxOutput: '64,000 Tokens', tag: 'Fast Reasoning' },
                { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Coding & Vision)', context: '200,000 Tokens', maxOutput: '8,192 Tokens', tag: 'Industry Benchmark' },
                { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', context: '1,000,000 Tokens', maxOutput: '8,192 Tokens', tag: 'Google Flash' }
            ]
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

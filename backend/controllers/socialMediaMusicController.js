const { GoogleGenerativeAI } = require('@google/generative-ai');

exports.recommendSongMatches = async (req, res) => {
  try {
    const { scriptText, category = 'all', mood = 'auto' } = req.body;

    if (!scriptText || typeof scriptText !== 'string' || !scriptText.trim()) {
      return res.status(400).json({ error: 'Please provide a video script, dialogue, or topic description.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are LUMI AI, an expert Sri Lankan Social Media Music Director & BGM Matcher for TikTok, Instagram Reels, and YouTube Shorts.

The user is making a social media video clip / reel.
Here is the description of the video script / spoken dialogue / topic:
"${scriptText}"

Preferred Category Filter: ${category}
Preferred Mood Filter: ${mood}

Your Goal:
1. Analyze the spoken dialogue, Singlish/Sinhala text, themes, punchlines, and funny/dramatic moments.
2. Identify core keywords and emotional vibe (e.g. "apaye raja", "hell king", "exam joke", "heartbreak", "motivation").
3. Recommend 5 to 7 PERFECT matching background songs, trending tracks, Sinhala classic/baila hits, or instrumental BGM scores.
4. For each recommendation, provide:
   - "songTitle": Full song title & original artist (e.g., "Yamalowa Ipaduna (Apaye Api Raja) - C.D. Fernando").
   - "artist": Artist / Creator / BGM name.
   - "category": Genre (e.g., "Sinhala Classic Comedy", "Trending Sinhala Baila", "Viral TikTok Sound", "Dramatic Cinematic BGM").
   - "lyricsSnippet": The exact catchy lyric line matching the video punchline (e.g. "යමලොව ඉපදුන අපායේ අපි රජ සෝමිකාරයෝ").
   - "matchReason": Singlish/English explanation of why this song matches this exact punchline or clip moment.
   - "suggestedBgmTiming": Exact recommendation on when to drop the music (e.g. "Start BGM at 0:08 right after the teacher's joke punchline!").
   - "searchQuery": Exact search string for YouTube (e.g., "Yamalowa ipaduna apaye api raja song").

Respond STRICTLY with valid JSON. Do not include markdown code block syntax outside the JSON.
Structure:
{
  "summary": "Brief 1-2 sentence analysis of the clip punchline and vibe in Singlish",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "recommendations": [
    {
      "songTitle": "Song Title",
      "artist": "Artist Name",
      "category": "Category Name",
      "lyricsSnippet": "Lyrics Snippet",
      "matchReason": "Explanation in Singlish/English",
      "suggestedBgmTiming": "Timing advice",
      "searchQuery": "Search Query for YouTube"
    }
  ]
}
`;

    const result = await model.generateContent(prompt);
    const rawResponse = result.response.text();

    // Clean JSON response
    let cleanedText = rawResponse.trim();
    if (cleanedText.startsWith('```json')) {
      cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    } else if (cleanedText.startsWith('```')) {
      cleanedText = cleanedText.replace(/^```\s*/, '').replace(/```$/, '').trim();
    }

    let parsedData;
    try {
      parsedData = JSON.parse(cleanedText);
    } catch (parseErr) {
      console.error('Failed to parse Gemini music response:', rawResponse);
      return res.status(500).json({
        error: 'Failed to generate song recommendations. Please try again.',
        rawText: rawResponse
      });
    }

    // Add direct YouTube search URLs
    if (parsedData.recommendations && Array.isArray(parsedData.recommendations)) {
      parsedData.recommendations = parsedData.recommendations.map(rec => ({
        ...rec,
        youtubeSearchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(rec.searchQuery || rec.songTitle)}`
      }));
    }

    return res.json({
      success: true,
      data: parsedData
    });

  } catch (err) {
    console.error('Error in recommendSongMatches:', err);
    return res.status(500).json({ error: 'Server error generating song recommendations: ' + err.message });
  }
};

const fs = require('fs');

exports.transcribeMedia = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a video or audio file.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Gemini API key is not configured on the server.' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype || 'video/mp4';
    const fileBuffer = fs.readFileSync(filePath);
    const base64Media = fileBuffer.toString('base64');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `
You are an expert native Sinhala and English speech-to-text transcriber specializing in Sri Lankan video clip, lecture, and social media reels.
Listen carefully to the audio of this uploaded video/audio file.

CRITICAL INSTRUCTIONS:
1. Transcribe ALL spoken speech into clear, high-accuracy natural text (Sinhala / Singlish / English as spoken).
2. Highlight any funny moments, student questions, lecturer joke punchlines, or key emotional topics.
3. Combine the transcription into a smooth, readable paragraph summarizing the exact dialogue and clip narrative.

Output MUST be a valid JSON object:
{
  "transcript": "Exact transcription and narrative summary of the spoken clip dialogue",
  "detectedLanguage": "Sinhala / English / Singlish",
  "punchlineSummary": "Short 1-sentence summary of the main punchline or clip moment"
}
`;

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType, data: base64Media } },
            { text: prompt }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const rawResponse = result.response.text();
    let parsedData = {};
    try {
      parsedData = JSON.parse(rawResponse);
    } catch (e) {
      parsedData = { transcript: rawResponse };
    }

    // Clean up file after reading
    try { fs.unlinkSync(filePath); } catch (_) {}

    return res.json({
      success: true,
      data: parsedData
    });

  } catch (err) {
    console.error('Error transcribing media file:', err);
    if (req.file && req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) {}
    }
    return res.status(500).json({ error: 'Failed to transcribe media file: ' + err.message });
  }
};

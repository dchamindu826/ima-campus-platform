/**
 * Production-Ready Sinhala Unicode <-> FM-Abhaya / DL-Fonts ANSI Converter
 * Optimized for CapCut, Adobe Premiere Pro, After Effects & Photoshop
 * Eliminates stray "ග" by safely stripping and handling punctuation/full stops.
 */

export const unicodeToLegacy = (text) => {
    if (!text) return "";
    let s = String(text);

    // 0. Remove English punctuation and full stops that collide with FM font glyphs (e.g. '.' maps to 'ග')
    s = s.replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();

    // 1. Special Compound Glyphs, Rakaranshaya, Yanshaya & Ligatures
    const compounds = [
        // Rakaranshaya + Kombuwa
        ['ක්‍රේ', 'fl%a'], ['ප්‍රේ', 'fm%a'], ['ත්‍රේ', 'f;%a'], ['ශ්‍රේ', 'fY%a'],
        ['ද්‍රේ', 'føa'], ['ග්‍රේ', 'f.%a'], ['බ්‍රේ', 'fn%a'],
        ['ක්‍රෝ', 'fl%da'], ['ප්‍රෝ', 'fm%da'], ['ත්‍රෝ', 'f;%da'],
        ['ක්‍රො', 'fl%d'], ['ප්‍රො', 'fm%d'],
        ['ක්‍රෙ', 'fl%'], ['ප්‍රෙ', 'fm%'],
        // Rakaranshaya
        ['ක්‍ර', 'l%'], ['ප්‍ර', 'm%'], ['ත්‍ර', ';%'], ['ශ්‍ර', 'Y%'],
        ['ද්‍ර', 'ø'], ['ග්‍ර', '.%'], ['බ්‍ර', 'n%'], ['ධ්‍ර', 'O%'], ['ව්‍ර', 'j%'],
        // Yanshaya
        ['ක්‍ය', 'lH'], ['ත්‍ය', ';H'], ['ප්‍ය', 'mH'], ['භ්‍ය', 'NH'],
        ['ම්‍ය', 'uH'], ['ව්‍ය', 'jH'], ['න්‍ය', 'kH'], ['ල්‍ය', ',H'],
        ['ද්‍ය', 'oH'], ['ග්‍ය', '.H'],
        // Special Ligatures / Bandi Akuru
        ['ක්‍ෂ', 'laI'], ['ඥ', '{\\'], ['ඤ', '['],
        ['ඳ', '`o'], ['ඟ', '`.'], ['ඬ', '`v'], ['ඹ', '`n'],
        // Special Paapili and Ispili Ligatures
        ['දු', 'ÿ'], ['ඳු', '`ÿ'], ['දූ', '¥'], ['ඳූ', '`¥'],
        ['රු', 're'], ['රූ', 'rE'],
        ['ලු', '¨'], ['ලූ', '¿'],
        ['තු', ';='], ['තූ', ';+']
    ];

    compounds.forEach(([u, f]) => {
        s = s.split(u).join(f);
    });

    // 2. Reorder Kombuwa (Kombuwa is 'f' in FM-Abhaya / FMBindumathi)
    // ේ -> 'f' + Consonant + 'a'
    s = s.replace(/([ක-ෆ])ේ/g, 'f$1a');
    // ෝ -> 'f' + Consonant + 'da'
    s = s.replace(/([ක-ෆ])ෝ/g, 'f$1da');
    // ො -> 'f' + Consonant + 'd'
    s = s.replace(/([ක-ෆ])ො/g, 'f$1d');
    // ෞ -> 'f' + Consonant + '!'
    s = s.replace(/([ක-ෆ])ෞ/g, 'f$1!');
    // ෛ -> 'ff' + Consonant
    s = s.replace(/([ක-ෆ])ෛ/g, 'ff$1');
    // ෙ -> 'f' + Consonant
    s = s.replace(/([ක-ෆ])ෙ/g, 'f$1');

    // 3. Standalone Vowels
    const vowels = [
        ['අ', 'w'], ['ආ', 'wd'], ['ඇ', 'we'], ['ඈ', 'wE'],
        ['ඉ', 'b'], ['ඊ', 'B'], ['උ', 'W'], ['ඌ', 'W`'],
        ['එ', 't'], ['ඒ', 'ta'], ['ඔ', 'T'], ['ඕ', 'Ta'], ['ඖ', 'TO']
    ];
    vowels.forEach(([u, f]) => {
        s = s.split(u).join(f);
    });

    // 4. Exact Consonants (Wijesekara FM-Abhaya Mapping)
    const consonants = [
        ['ක', 'l'], ['ඛ', 'L'], ['ග', '.'], ['ඝ', '>'], ['ඞ', 'X'],
        ['ච', 'p'], ['ඡ', 'P'], ['ජ', 'c'], ['ඣ', 'C'],
        ['ට', 'g'], ['ඨ', 'G'], ['ඩ', 'v'], ['ඪ', 'V'], ['ණ', 'K'],
        ['ත', ';'], ['ථ', ':'], ['ද', 'o'], ['ධ', 'O'], ['න', 'k'],
        ['ප', 'm'], ['ඵ', 'M'], ['බ', 'n'], ['භ', 'N'], ['ම', 'u'],
        ['ය', 'h'], ['ර', 'r'], ['ල', ','], ['ව', 'j'], ['ශ', 'Y'], ['ෂ', 'I'],
        ['ස', 'i'], ['හ', 'y'], ['ළ', '<'], ['ෆ', '*']
    ];
    consonants.forEach(([u, f]) => {
        s = s.split(u).join(f);
    });

    // 5. Vowel Modifiers & Hal Lakuna
    const modifiers = [
        ['ා', 'd'], ['ැ', 'e'], ['ෑ', 'E'], ['ි', 's'], ['ී', 'S'],
        ['ු', 'q'], ['ූ', 'Q'], ['්', 'a'], ['ෲ', 'D'], ['ෘ', 'D'], ['ං', 'x']
    ];
    modifiers.forEach(([u, f]) => {
        s = s.split(u).join(f);
    });

    return s;
};

// Helper to guarantee single-track sequential non-overlapping timings for CapCut
export const ensureSequentialCues = (cues) => {
    if (!cues || cues.length === 0) return [];
    
    // Sort in ascending start time order
    const sorted = [...cues].sort((a, b) => a.start - b.start);

    for (let i = 0; i < sorted.length; i++) {
        const curr = sorted[i];
        const next = sorted[i + 1];

        // Ensure minimum cue duration of 0.15s
        if (curr.end <= curr.start) {
            curr.end = parseFloat((curr.start + 0.25).toFixed(2));
        }

        // Prevent overlap with next cue (leave a 40ms gap so CapCut stays strictly on Track 1)
        if (next && curr.end >= next.start) {
            curr.end = parseFloat(Math.max(curr.start + 0.1, next.start - 0.04).toFixed(2));
        }
    }

    return sorted;
};

// Word-by-Word SRT Splitter Helper for CapCut Granular Customization
export const splitCaptionsWordByWord = (captions, convertToFM = false) => {
    return splitCaptionsByChunks(captions, 1, convertToFM);
};

// Phrase-by-Phrase (2-3 words, or custom chunk size) SRT & Cue Splitter/Merger Helper
export const splitCaptionsByChunks = (captions, chunkSize = 3, convertToFM = false) => {
    if (!captions || captions.length === 0) return [];

    // 1. Flatten all captions/cues into timed single-word units
    const allWords = [];
    captions.forEach(cap => {
        const cleanRaw = (cap.originalText || cap.text || '').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ').trim();
        if (!cleanRaw) return;

        const words = cleanRaw.split(/\s+/).filter(w => w.length > 0);
        if (words.length === 0) return;

        if (words.length === 1) {
            allWords.push({
                text: words[0],
                start: parseFloat(cap.start.toFixed(2)),
                end: parseFloat(cap.end.toFixed(2))
            });
        } else {
            const totalDuration = Math.max(0.3, cap.end - cap.start);
            const totalChars = words.reduce((acc, w) => acc + w.length, 0);
            let currentStart = cap.start;

            words.forEach((w, wIdx) => {
                const charWeight = w.length / totalChars;
                const wordDur = Math.max(0.15, totalDuration * charWeight);
                const wordEnd = (wIdx === words.length - 1) ? cap.end : parseFloat((currentStart + wordDur).toFixed(2));

                allWords.push({
                    text: w,
                    start: parseFloat(currentStart.toFixed(2)),
                    end: parseFloat(Math.max(currentStart + 0.15, wordEnd).toFixed(2))
                });

                currentStart = wordEnd;
            });
        }
    });

    if (allWords.length === 0) return [];

    // If chunkSize is set to 999 or higher, retain original sentence boundaries if available
    if (chunkSize >= 99) {
        return ensureSequentialCues(captions.map((cap, i) => {
            const clean = (cap.originalText || cap.text || '').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ').trim();
            return {
                id: i + 1,
                start: cap.start,
                end: cap.end,
                text: convertToFM ? unicodeToLegacy(clean) : clean,
                originalText: clean
            };
        }));
    }

    // 2. Group words into phrase chunks of size chunkSize (e.g. 2 or 3 words)
    const chunkedCues = [];
    let cueId = 1;

    for (let i = 0; i < allWords.length; i += chunkSize) {
        const chunk = allWords.slice(i, i + chunkSize);
        const chunkStart = chunk[0].start;
        const chunkEnd = chunk[chunk.length - 1].end;
        const phraseText = chunk.map(w => w.text).join(' ');
        const finalPhrase = convertToFM ? unicodeToLegacy(phraseText) : phraseText;

        chunkedCues.push({
            id: cueId++,
            start: chunkStart,
            end: parseFloat(Math.max(chunkStart + 0.25, chunkEnd).toFixed(2)),
            text: finalPhrase,
            originalText: phraseText
        });
    }

    return ensureSequentialCues(chunkedCues);
};

// Natural Script & Voice Pause Sync Splitter Helper
// Dynamically groups words into natural spoken phrases matching audio pauses and script clauses
export const splitCaptionsByScriptSync = (rawSegments = [], wordCues = [], maxCharsPerCard = 28, convertToFM = false) => {
    // If rawSegments (sentence/phrase segments from Gemini STT) exist, use them as phrase anchors
    if (rawSegments && rawSegments.length > 0) {
        const syncedCues = [];
        let cueId = 1;

        rawSegments.forEach(seg => {
            const cleanRaw = (seg.originalText || seg.text || '').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ').trim();
            if (!cleanRaw) return;

            const words = cleanRaw.split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) return;

            // If phrase is within natural reading length (~28 chars), keep as 1 natural phrase card
            if (cleanRaw.length <= maxCharsPerCard || words.length <= 4) {
                const finalPhrase = convertToFM ? unicodeToLegacy(cleanRaw) : cleanRaw;
                syncedCues.push({
                    id: cueId++,
                    start: parseFloat(seg.start.toFixed(2)),
                    end: parseFloat(seg.end.toFixed(2)),
                    text: finalPhrase,
                    originalText: cleanRaw
                });
            } else {
                // If phrase segment is long, break at natural sub-phrase boundaries (~2-3 words)
                const totalDuration = Math.max(0.6, seg.end - seg.start);
                const totalChars = words.reduce((acc, w) => acc + w.length, 0);

                let currentChunk = [];
                let currentLen = 0;
                let chunkStart = seg.start;
                let accumulatedDuration = 0;

                words.forEach((word, wIdx) => {
                    const charWeight = word.length / totalChars;
                    const wordDur = totalDuration * charWeight;

                    currentChunk.push(word);
                    currentLen += word.length + 1;
                    accumulatedDuration += wordDur;

                    const isLastWord = wIdx === words.length - 1;
                    // Break if max length reached OR if 3+ words accumulated
                    if (currentLen >= maxCharsPerCard || currentChunk.length >= 3 || isLastWord) {
                        const phraseText = currentChunk.join(' ');
                        const chunkEnd = isLastWord ? seg.end : parseFloat((chunkStart + Math.max(0.3, accumulatedDuration)).toFixed(2));
                        const finalPhrase = convertToFM ? unicodeToLegacy(phraseText) : phraseText;

                        syncedCues.push({
                            id: cueId++,
                            start: parseFloat(chunkStart.toFixed(2)),
                            end: parseFloat(Math.max(chunkStart + 0.25, chunkEnd).toFixed(2)),
                            text: finalPhrase,
                            originalText: phraseText
                        });

                        chunkStart = chunkEnd;
                        currentChunk = [];
                        currentLen = 0;
                        accumulatedDuration = 0;
                    }
                });
            }
        });

        return ensureSequentialCues(syncedCues);
    }

    // Fallback: If no segments available, sync by natural audio pause gaps between word cues
    if (!wordCues || wordCues.length === 0) return [];

    const syncedCues = [];
    let cueId = 1;
    let currentPhraseWords = [];
    let phraseStart = wordCues[0].start;

    wordCues.forEach((wordCue, idx) => {
        const cleanWord = (wordCue.originalText || wordCue.text || '').replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, ' ').trim();
        if (!cleanWord) return;

        if (currentPhraseWords.length === 0) {
            phraseStart = wordCue.start;
        }

        currentPhraseWords.push(cleanWord);
        const currentText = currentPhraseWords.join(' ');

        const nextCue = wordCues[idx + 1];
        const isPauseAfter = nextCue ? (nextCue.start - wordCue.end > 0.35) : true;
        const isMaxWords = currentPhraseWords.length >= 3;
        const isMaxChars = currentText.length >= maxCharsPerCard;

        if (isPauseAfter || isMaxWords || isMaxChars || idx === wordCues.length - 1) {
            const finalPhrase = convertToFM ? unicodeToLegacy(currentText) : currentText;
            syncedCues.push({
                id: cueId++,
                start: parseFloat(phraseStart.toFixed(2)),
                end: parseFloat(wordCue.end.toFixed(2)),
                text: finalPhrase,
                originalText: currentText
            });
            currentPhraseWords = [];
        }
    });

    return ensureSequentialCues(syncedCues);
};

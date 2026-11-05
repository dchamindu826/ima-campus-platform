export const convertSinglishToSinhala = (text) => {
    if (!text) return "";
    
    let s = text;
    
    // Helakuru-style phonetic mapping rules
    // Order matters! Longest patterns must be replaced first.
    
    // 1. Independent Vowels (when they appear at the start of a word or after another vowel)
    // We will do a different approach:
    // First, identify consonant clusters and attach vowels to them.
    // Anything left over that matches a vowel gets independent vowel.
    
    // A simpler regex-based approach used in popular converters:
    const map = [
        // Special consonants
        {"e": "nndh", "s": "ඳ"}, {"e": "nnd", "s": "ඬ"}, {"e": "nng", "s": "ඟ"}, {"e": "mmb", "s": "ඹ"},
        {"e": "kh", "s": "ඛ"}, {"e": "gh", "s": "ඝ"}, {"e": "Ch", "s": "ඡ"}, {"e": "jh", "s": "ඣ"},
        {"e": "th", "s": "ත"}, {"e": "Th", "s": "ථ"}, {"e": "dh", "s": "ධ"}, {"e": "Dh", "s": "ඪ"},
        {"e": "ph", "s": "ඵ"}, {"e": "bh", "s": "භ"}, {"e": "sh", "s": "ශ"}, {"e": "Sh", "s": "ෂ"},
        {"e": "gn", "s": "ඥ"}, {"e": "kn", "s": "ඥ"},

        // Basic consonants
        {"e": "k", "s": "ක"}, {"e": "K", "s": "ඛ"}, {"e": "g", "s": "ග"}, {"e": "G", "s": "ඝ"},
        {"e": "c", "s": "ච"}, {"e": "C", "s": "ඡ"}, {"e": "j", "s": "ජ"}, {"e": "J", "s": "ඣ"},
        {"e": "t", "s": "ට"}, {"e": "T", "s": "ඨ"}, {"e": "d", "s": "ද"}, {"e": "D", "s": "ඩ"},
        {"e": "n", "s": "න"}, {"e": "N", "s": "ණ"}, {"e": "p", "s": "ප"}, {"e": "P", "s": "ඵ"},
        {"e": "b", "s": "බ"}, {"e": "B", "s": "භ"}, {"e": "m", "s": "ම"}, {"e": "M", "s": "ං"},
        {"e": "y", "s": "ය"}, {"e": "r", "s": "ර"}, {"e": "l", "s": "ල"}, {"e": "L", "s": "ළ"},
        {"e": "v", "s": "ව"}, {"e": "V", "s": "ව"}, {"e": "w", "s": "ව"}, {"e": "W", "s": "ව"},
        {"e": "s", "s": "ස"}, {"e": "S", "s": "ශ"}, {"e": "h", "s": "හ"}, {"e": "H", "s": "ඃ"},
        {"e": "f", "s": "ෆ"}, {"e": "F", "s": "ෆ"}, {"e": "z", "s": "ස"}, {"e": "x", "s": "ෂ"},
        {"e": "R", "s": "ඍ"}
    ];

    const vowels = [
        {"e": "aae", "s": "ෑ", "i": "ඈ"},
        {"e": "ae", "s": "ැ", "i": "ඇ"},
        {"e": "aa", "s": "ා", "i": "ආ"},
        {"e": "a", "s": "", "i": "අ"},
        {"e": "ii", "s": "ී", "i": "ඊ"},
        {"e": "i", "s": "ි", "i": "ඉ"},
        {"e": "uu", "s": "ූ", "i": "ඌ"},
        {"e": "u", "s": "ු", "i": "උ"},
        {"e": "ee", "s": "ේ", "i": "ඒ"},
        {"e": "e", "s": "ෙ", "i": "එ"},
        {"e": "oo", "s": "ෝ", "i": "ඕ"},
        {"e": "o", "s": "ො", "i": "ඔ"},
        {"e": "au", "s": "ෞ", "i": "ඖ"},
        {"e": "ai", "s": "ෛ", "i": "ඓ"}
    ];

    let words = s.split(/(\s+)/);
    
    let result = words.map(word => {
        if (/^[A-Z0-9]+$/.test(word)) return word; 
        if (!/[a-zA-Z]/.test(word)) return word;
        
        let w = word;
        
        w = w.replace(/ruu/g, "ෲ");
        w = w.replace(/ru/g, "ෘ");

        for (let i = 0; i < map.length; i++) {
            let cons = map[i].e;
            let sinCons = map[i].s;
            
            for (let j = 0; j < vowels.length; j++) {
                let vow = vowels[j].e;
                let sinVow = vowels[j].s;
                
                let pattern = new RegExp(cons + vow, "g");
                w = w.replace(pattern, sinCons + sinVow);
            }
        }
        
        for (let i = 0; i < map.length; i++) {
            let cons = map[i].e;
            let sinCons = map[i].s;
            let pattern = new RegExp(cons, "g");
            w = w.replace(pattern, sinCons + "්");
        }
        
        for (let i = 0; i < vowels.length; i++) {
            let vow = vowels[i].e;
            let indVow = vowels[i].i;
            let pattern = new RegExp(vow, "g");
            w = w.replace(pattern, indVow);
        }
        
        w = w.replace(/්ය/g, "්‍ය");
        w = w.replace(/්ර/g, "්‍ර");

        return w;
    });

    return result.join('');
};

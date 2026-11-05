// Example: routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { normalizePhone } = require('../utils/phoneUtils');

// 🔥 Frontend Landing Page Eke Businesses ganna Route Eka 🔥
router.get('/landing-data', async (req, res) => {
    try {
        const businesses = await prisma.business.findMany({
            where: { status: 1 },
            include: {
                batches: {
                    where: { status: 1 }
                }
            }
        });

        // Safe JSON Parse for BigInt (if any)
        const safeData = JSON.parse(JSON.stringify(businesses, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));

        res.status(200).json({ businesses: safeData });
    } catch (error) {
        console.error("Landing Data Error:", error);
        res.status(500).json({ error: "Failed to load landing data" });
    }
});

// 🔥 Voice AI Agent: Active Courses & Batches for Gemini Receptionist
router.get('/voice-agent/courses', async (req, res) => {
    try {
        const businesses = await prisma.business.findMany({
            where: { status: 1 },
            select: {
                id: true,
                name: true,
                category: true,
                medium: true,
                description: true,
                batches: {
                    where: { status: 1 },
                    select: {
                        id: true,
                        name: true,
                        groups: {
                            select: {
                                name: true,
                                courses: {
                                    select: {
                                        id: true,
                                        name: true,
                                        price: true,
                                        lecturerName: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        const formatted = businesses
            .filter(b => !b.name.toLowerCase().includes('test'))
            .map(b => {
                const activeBatch = b.batches[b.batches.length - 1] || b.batches[0];
                const subjectList = [];
                if (activeBatch && activeBatch.groups) {
                    for (const g of activeBatch.groups) {
                        for (const c of g.courses || []) {
                            if (c.name && !subjectList.includes(c.name)) {
                                subjectList.push(c.name);
                            }
                        }
                    }
                }
                return {
                    businessId: b.id,
                    batchId: activeBatch ? activeBatch.id : null,
                    courseName: b.name,
                    category: b.category,
                    medium: b.medium || 'Sinhala',
                    batchName: activeBatch ? activeBatch.name : '',
                    subjects: subjectList.slice(0, 6),
                    delivery: 'Online Live via Zoom + LMS Recording Access + Home Tute Delivery'
                };
            });

        res.json({
            success: true,
            institute: "IMA Campus",
            courses: formatted
        });
    } catch (error) {
        console.error("Voice Agent Courses Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔥 Voice AI Agent: Available Demo Slots
router.get('/voice-agent/demo-slots', async (req, res) => {
    try {
        const slots = [
            {
                slot_id: "S_TECH_SAT_10AM",
                stream: "Technology (ටෙක් අංශය)",
                course: "A/L Technology (ටක් ගාලා ටෙක් කරමු)",
                when: "සෙනසුරාදා උදේ 10.00",
                when_speech: "Sethsenada udeta dahayata",
                title: "A/L Tech නොමිලේ Demo පන්තිය (Zoom)",
                businessId: 4,
                batchId: 52
            },
            {
                slot_id: "S_ART_SAT_3PM",
                stream: "Arts (කලා අංශය)",
                course: "මාස 06න් A/L - Art",
                when: "සෙනසුරාදා හවස 3.00",
                when_speech: "Sethsenada hawasa thunata",
                title: "මාස 6න් Art නොමිලේ Demo පන්තිය (Zoom)",
                businessId: 1,
                batchId: 49
            },
            {
                slot_id: "S_COMM_SUN_10AM",
                stream: "Commerce (වාණිජ අංශය)",
                course: "මාස 06න් A/L - Commerce",
                when: "ඉරිදා උදේ 10.00",
                when_speech: "Irida udeta dahayata",
                title: "මාස 6න් Commerce නොමිලේ Demo පන්තිය (Zoom)",
                businessId: 6,
                batchId: 50
            },
            {
                slot_id: "S_OL_SUN_4PM",
                stream: "O/L (සාමාන්‍ය පෙළ)",
                course: "මාස 06න් O/L",
                when: "ඉරිදා හවස 4.00",
                when_speech: "Irida hawasa hatharata",
                title: "මාස 6න් O/L නොමිලේ Demo පන්තිය (Zoom)",
                businessId: 9,
                batchId: 20
            },
            {
                slot_id: "S_ENG_SUN_7PM",
                stream: "English / Spoken",
                course: "IMA English",
                when: "ඉරිදා රෑ 7.00",
                when_speech: "Irida rae hathata",
                title: "IMA English නොමිලේ Demo පන්තිය (Zoom)",
                businessId: 10,
                batchId: 53
            },
            {
                slot_id: "S_LAW_SAT_6PM",
                stream: "Law (නීති ප්‍රවේශය)",
                course: "IMA LAW SCHOOL",
                when: "සෙනසුරාදා හවස 6.00",
                when_speech: "Sethsenada hawasa hayata",
                title: "LLB Entrance / Diploma in Law Demo (Zoom)",
                businessId: 18,
                batchId: 48
            }
        ];

        res.json({
            success: true,
            slots: slots
        });
    } catch (error) {
        console.error("Voice Agent Slots Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔥 Voice AI Agent: Book Lead directly into IMA Campus CRM
router.post('/voice-agent/book-lead', async (req, res) => {
    try {
        const { name, phone, course, slot_id, slot_when, notes } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, error: "Phone number is required" });
        }

        const normalizedPhone = normalizePhone(phone) || String(phone).replace(/[^0-9]/g, '');

        // Determine business & batch mapping based on course / slot
        let businessId = 1; // Default: Arts
        let batchId = 49;

        const cLower = `${course || ''} ${slot_id || ''}`.toLowerCase();
        if (cLower.includes('tech') || cLower.includes('තාක්ෂණ') || cLower.includes('sft')) {
            businessId = 4;
            batchId = 52;
        } else if (cLower.includes('comm') || cLower.includes('වාණිජ') || cLower.includes('account')) {
            businessId = 6;
            batchId = 50;
        } else if (cLower.includes('o/l') || cLower.includes('ol') || cLower.includes('සාමාන්‍ය')) {
            businessId = 9;
            batchId = 20;
        } else if (cLower.includes('eng') || cLower.includes('english')) {
            businessId = 10;
            batchId = 53;
        } else if (cLower.includes('law') || cLower.includes('නීති')) {
            businessId = 18;
            batchId = 48;
        } else if (cLower.includes('media') || cLower.includes('මාධ්‍ය')) {
            businessId = 16;
            batchId = 55;
        }

        const dbPhone = `${normalizedPhone}_BIZ_${businessId}_BATCH_${batchId}`;
        const feedbackText = `Voice AI Agent (Nethmi) Booking | Slot: ${slot_when || slot_id || 'Not specified'} | Course: ${course || 'General'} | Notes: ${notes || 'Booked via Gemini Live Call'}`;

        const lead = await prisma.lead.upsert({
            where: { phone: dbPhone },
            update: {
                name: name || undefined,
                feedback: feedbackText,
                source: 'ai_voice_call',
                callStatus: 'booked',
                updatedAt: new Date()
            },
            create: {
                name: name || 'Caller',
                phone: dbPhone,
                batchId: batchId,
                source: 'ai_voice_call',
                campaignType: 'FREE_SEMINAR',
                status: 'NEW',
                phase: 1,
                callStatus: 'booked',
                paymentIntention: 'NOT_DECIDED',
                enrollmentStatus: 'NON_ENROLLED',
                inquiryType: 'NORMAL',
                feedback: feedbackText,
                lastMessage: `Free Demo booked for ${slot_when || 'Upcoming Session'}`,
                lastMessageAt: new Date()
            }
        });

        console.log(`[Voice AI Agent] ✅ New Lead Booked: Lead ID: ${lead.id}, Name: ${lead.name}, Phone: ${normalizedPhone}, Slot: ${slot_when}`);

        return res.status(201).json({
            success: true,
            leadId: lead.id,
            name: lead.name,
            phone: normalizedPhone,
            course: course || 'General',
            slot: slot_when || slot_id,
            message: "Lead successfully recorded in IMA Campus CRM!"
        });
    } catch (error) {
        console.error("Voice Agent Book Lead Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

let cachedDatabaseKnowledge = "";
let lastKnowledgeFetch = 0;

async function getLiveDatabaseKnowledge() {
    const now = Date.now();
    if (cachedDatabaseKnowledge && (now - lastKnowledgeFetch < 300000)) {
        return cachedDatabaseKnowledge;
    }

    try {
        const businesses = await prisma.business.findMany({
            where: { status: 1 },
            select: {
                id: true,
                name: true,
                category: true,
                medium: true,
                description: true,
                batches: {
                    where: { status: 1 },
                    select: {
                        id: true,
                        name: true,
                        lecturers: true,
                        groups: {
                            select: {
                                name: true,
                                courses: {
                                    select: { id: true, name: true, price: true, lecturerName: true }
                                }
                            }
                        }
                    }
                }
            }
        });

        const lines = [
            "=== IMA CAMPUS සම්පූර්ණ සජීවී දත්ත පද්ධතිය (LIVE DATABASE KNOWLEDGE) ===",
            "ආයතනයේ නම: IMA Campus (ශ්‍රී ලංකාවේ ප්‍රමුඛතම ඔන්ලයින් උසස් අධ්‍යාපන ආයතනය)",
            "පන්ති පැවැත්වෙන ආකාරය: Live Zoom පන්ති + සෑම පන්තියකටම LMS Recording Access + මුද්‍රිත Tutes කුරියර් මගින් නිවසටම බෙදාහැරීම.",
            "ගාස්තු ගෙවීම් ක්‍රම: බැංකු තැන්පතු, ඔන්ලයින් කාඩ්පත් ගෙවීම් හෝ මාසික වාරික ක්‍රමයට පහසුවෙන් ගෙවිය හැක.",
            "\nපවතින ප්‍රධාන පාඨමාලා, අංශ, කණ්ඩායම්, විෂයයන්, ගාස්තු සහ දේශකවරුන්:"
        ];

        for (const b of businesses) {
            if (b.name.toLowerCase().includes('test')) continue;
            lines.push(`\n▶ [අංශය / ආයතනය: ${b.name} (${b.medium || 'Sinhala'} Medium)]`);
            for (const bat of b.batches) {
                lines.push(`  • කණ්ඩායම (Batch): ${bat.name}`);
                let lecs = '';
                try {
                    const parsed = JSON.parse(bat.lecturers || '[]');
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        lecs = parsed.map(l => l.name).filter(Boolean).join(', ');
                    }
                } catch(e) {}
                if (lecs) lines.push(`    දේශකවරුන්: ${lecs}`);

                for (const g of bat.groups) {
                    const subList = g.courses.map(c => `${c.name}${c.price ? ' (රු. ' + c.price + ')' : ''}${c.lecturerName ? ' [දේශක: ' + c.lecturerName + ']' : ''}`).join(', ');
                    if (subList) {
                        lines.push(`    - ${g.name}: ${subList}`);
                    }
                }
            }
        }

        cachedDatabaseKnowledge = lines.join('\n');
        lastKnowledgeFetch = now;
        return cachedDatabaseKnowledge;
    } catch (err) {
        console.error("Error generating live database knowledge:", err);
        return cachedDatabaseKnowledge || "IMA Campus Live Database Knowledge unavailable";
    }
}

// Helper function: Convert raw 16-bit 24kHz mono PCM buffer to standard playable WAV buffer
function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBuffer.length;
    const header = Buffer.alloc(44);

    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, pcmBuffer]);
}

// In-memory cache for ultra-fast Kore studio neural voice playback
const audioMemoryCache = new Map();
const GREETING_TEXT = "ආයුබෝවන්! IMA Campus එකෙන් නෙත්මි කතා කරන්නේ. මම ඔයාට කොහොමද උදව් කරන්න පුළුවන්?";

// Dedicated High-Fidelity Studio Neural Voice Synthesizer — Exclusively locked to Kore
async function synthesizeAudio(text) {
    const clean = text.replace(/[*#_~`]/g, '').trim();
    if (!clean) return null;

    const cacheKey = `Kore_${clean}`;
    if (audioMemoryCache.has(cacheKey)) {
        return audioMemoryCache.get(cacheKey);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;

    const axios = require('axios');
    const geminiTtsUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;

    try {
        const aiRes = await axios.post(geminiTtsUrl, {
            contents: [{ parts: [{ text: clean }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: "Kore" }
                    }
                }
            }
        }, { timeout: 15000 });

        const candidate = aiRes.data?.candidates?.[0];
        const inlineAudio = candidate?.content?.parts?.[0]?.inlineData;

        if (inlineAudio && inlineAudio.data) {
            const pcmBuffer = Buffer.from(inlineAudio.data, 'base64');
            const wavBuffer = pcmToWav(pcmBuffer, 24000);
            const result = { buffer: wavBuffer, mimeType: 'audio/wav', base64: wavBuffer.toString('base64') };
            if (audioMemoryCache.size > 300) audioMemoryCache.clear();
            audioMemoryCache.set(cacheKey, result);
            return result;
        }
    } catch (geminiErr) {
        console.error("Kore Studio Voice Error:", geminiErr.response?.data || geminiErr.message);
    }
    return null;
}

// Pre-render and cache Kore greeting in memory on server start
async function warmUpKoreGreeting() {
    try {
        await synthesizeAudio(GREETING_TEXT);
        console.log("Kore studio voice greeting cached successfully!");
    } catch (e) {
        console.warn("Kore warm-up warning:", e.message);
    }
}
setTimeout(warmUpKoreGreeting, 500);

// 🔥 Voice AI Agent: Interactive Browser Chat / Audio Bridge with Gemini & Real CRM Tools
router.post('/voice-agent/chat', async (req, res) => {
    try {
        const { message, history = [], isGreeting = false } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, error: "Message is required" });
        }

        // ⚡ INSTANT GREETING: If call just connected or greeting requested, return pre-cached Kore audio in <10ms!
        if (isGreeting || message.includes("ඇමතුම සම්බන්ධ විය")) {
            const greetingAudio = await synthesizeAudio(GREETING_TEXT);
            return res.json({
                success: true,
                reply: GREETING_TEXT,
                audioBase64: greetingAudio ? greetingAudio.base64 : null,
                mimeType: 'audio/wav',
                ttsUrl: `/api/public/voice-agent/tts?text=${encodeURIComponent(GREETING_TEXT)}`,
                toolExecutions: [],
                leadCreated: null,
                updatedHistory: [
                    { role: 'model', parts: [{ text: GREETING_TEXT }] }
                ]
            });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ success: false, error: "GEMINI_API_KEY is not configured in backend environment" });
        }

        const dbKnowledge = await getLiveDatabaseKnowledge();

        const SYSTEM_PROMPT = `ඔබ IMA Campus උසස් අධ්‍යාපන ආයතනයේ ප්‍රධාන දුරකථන පිළිගැනීමේ නිලධාරිනී (Chief Phone Receptionist) "නෙත්මි" වේ.

🚨 අතිශය වැදගත් දුරකථන ඇමතුම් නීති (PHONE CALL STRICT RULES - CRITICAL):
1. පිළිතුර අතිශය කෙටි විය යුතුය: උපරිම වචන 10-18ක් පමණි! (වාක්‍ය 1ක් හෝ උපරිම වාක්‍ය 2ක් පමණයි). කිසි විටෙකත් දිගු ඡේද නොකියන්න.
2. සෘජුවම අහපු දේට කෙටි පිළිතුර දී, කෙටි ප්‍රශ්නයකින් හෝ Demo පන්තියට යොමු කරමින් අවසන් කරන්න.
   - උදාහරණය 1 (දේශකයා ගැන ඇසුවොත්): "ගයාන් ඉද්දමල්ගොඩ සර් තමයි Media සහ Law උගන්වන්නේ. ඔයාට 2027 ද 2028 ද ඕනෙ?"
   - උදාහරණය 2 (ගාස්තු ඇසුවොත්): "මාසික ගාස්තුව රුපියල් 3,500යි. සෙනසුරාදා තියෙන නොමිලේ ඩෙමෝ එකට රෙජිස්ටර් කරන්නද?"
   - උදාහරණය 3 (විෂයයන් ඇසුවොත්): "Technology, Arts, Commerce, O/L වගේ විෂය ධාරා තියෙනවා. ඔයා හොයන්නේ මොන විෂය ගැනද?"
3. කිසිවිටෙකත් "මම දන්නේ නෑ" නොකියන්න. පහත සජීවී දත්ත පද්ධතියෙන් බලා නිවැරදි තොරතුර සෘජුව කියන්න.
4. 100% ක්ම පැහැදිලි සිංහලෙන් (Unicode සිංහල අකුරෙන්) පමණක් කථා කරන්න. Singlish හෝ ඉංග්‍රීසි අකුරින් නොලියන්න.
5. සුහද, මිත්‍රශීලීව "ඔයා" යොදාගන්න.

--- සජීවී දත්ත පද්ධතිය (LIVE DATABASE KNOWLEDGE) ---
${dbKnowledge}
---------------------------------------------------
`;

        const TOOLS_DECLARATION = [{
            function_declarations: [
                {
                    name: "get_demo_slots",
                    description: "IMA Campus eke free demo class walata thiyena welawaval list eka ganna.",
                    parameters: { type: "OBJECT", properties: {} }
                },
                {
                    name: "get_courses",
                    description: "IMA Campus eke thiyena courses saha subjects list eka ganna.",
                    parameters: { type: "OBJECT", properties: {} }
                },
                {
                    name: "search_database",
                    description: "IMA Campus database eken specific course ekak, fee ekak hari lecturer kenek gana search karanna.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            keyword: { type: "STRING", description: "Search karanna ona keyword eka (e.g. Technology, Law, Dinesh Chandrasena, 2027)" }
                        },
                        required: ["keyword"]
                    }
                },
                {
                    name: "book_demo_class",
                    description: "Customerwa IMA Campus CRM ekata free demo class ekakata register karanna. Name, phone number saha slot eka confirm kalata passe call karanna.",
                    parameters: {
                        type: "OBJECT",
                        properties: {
                            name: { type: "STRING", description: "Customerge nama" },
                            phone: { type: "STRING", description: "Customerge phone number eka" },
                            slot_id: { type: "STRING", description: "get_demo_slots eken ena slot_id eka" },
                            course: { type: "STRING", description: "Course / Stream eka" }
                        },
                        required: ["name", "phone", "slot_id"]
                    }
                }
            ]
        }];

        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

        // Format conversation history for Gemini
        const contents = [];
        for (const item of history) {
            if (item.role && item.parts) {
                contents.push(item);
            } else if (item.sender === 'user') {
                contents.push({ role: 'user', parts: [{ text: item.text }] });
            } else if (item.sender === 'ai') {
                contents.push({ role: 'model', parts: [{ text: item.text }] });
            }
        }
        contents.push({ role: 'user', parts: [{ text: message }] });

        const axios = require('axios');
        let currentContents = [...contents];
        let toolExecutions = [];
        let leadCreated = null;
        let finalReply = "";

        // Loop up to 3 turns to resolve any function calls
        for (let turn = 0; turn < 3; turn++) {
            const geminiRes = await axios.post(geminiUrl, {
                system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                tools: TOOLS_DECLARATION,
                contents: currentContents,
                generationConfig: {
                    temperature: 0.25,
                    thinkingConfig: { thinkingBudget: 0 },
                    maxOutputTokens: 150
                }
            }, { timeout: 10000 });

            const candidate = geminiRes.data?.candidates?.[0]?.content;
            if (!candidate) {
                finalReply = "සමාවෙන්න, මට ඒක තව සැරයක් කියන්න පුළුවන්ද?";
                break;
            }

            currentContents.push(candidate);

            const functionCalls = candidate.parts?.filter(p => p.functionCall) || [];
            if (functionCalls.length === 0) {
                // Normal text response
                const textParts = candidate.parts?.filter(p => p.text).map(p => p.text) || [];
                finalReply = textParts.join(" ").trim();
                break;
            }

            // Execute function calls
            for (const fc of functionCalls) {
                const fnName = fc.functionCall.name;
                const fnArgs = fc.functionCall.args || {};

                let toolResult = {};
                if (fnName === "get_demo_slots") {
                    toolResult = {
                        slots: [
                            { slot_id: "S_TECH_SAT_10AM", course: "A/L Technology", when: "Sethsenada udeta 10.00" },
                            { slot_id: "S_ART_SAT_3PM", course: "A/L Arts", when: "Sethsenada hawasa 3.00" },
                            { slot_id: "S_COMM_SUN_10AM", course: "A/L Commerce", when: "Irida udeta 10.00" },
                            { slot_id: "S_OL_SUN_4PM", course: "O/L Classes", when: "Irida hawasa 4.00" },
                            { slot_id: "S_ENG_SUN_7PM", course: "IMA English", when: "Irida rae 7.00" },
                            { slot_id: "S_LAW_SAT_6PM", course: "IMA Law School", when: "Sethsenada hawasa 6.00" }
                        ]
                    };
                    toolExecutions.push({ tool: fnName, args: fnArgs, result: "Demo slots retrieved" });
                } else if (fnName === "get_courses") {
                    toolResult = {
                        courses: [
                            { course: "A/L Technology", subjects: ["SFT", "ET", "BST", "ICT", "Agri"] },
                            { course: "A/L Arts", subjects: ["Media", "Sinhala", "Buddhist Civ", "Pol Sci", "Geography"] },
                            { course: "A/L Commerce", subjects: ["Accounting", "Economics", "Business Studies", "ICT"] },
                            { course: "O/L Revision", subjects: ["Maths", "Science", "Sinhala", "English", "History", "Commerce"] },
                            { course: "IMA English", subjects: ["Spoken English", "Grammar"] },
                            { course: "IMA Law School", subjects: ["Diploma in Law", "LLB Entrance"] }
                        ]
                    };
                    toolExecutions.push({ tool: fnName, args: fnArgs, result: "Courses retrieved" });
                } else if (fnName === "search_database") {
                    const kw = String(fnArgs.keyword || '').toLowerCase();
                    const matches = await prisma.course.findMany({
                        where: {
                            OR: [
                                { name: { contains: kw } },
                                { lecturerName: { contains: kw } },
                                { stream: { contains: kw } }
                            ]
                        },
                        take: 6,
                        select: { name: true, price: true, lecturerName: true, stream: true }
                    });
                    toolResult = { keyword: kw, results: matches };
                    toolExecutions.push({ tool: fnName, args: fnArgs, matchCount: matches.length });
                } else if (fnName === "book_demo_class") {
                    const normPhone = normalizePhone(fnArgs.phone) || String(fnArgs.phone).replace(/[^0-9]/g, '');
                    let bId = 1;
                    let batId = 49;
                    const cLow = `${fnArgs.course || ''} ${fnArgs.slot_id || ''}`.toLowerCase();
                    if (cLow.includes('tech') || cLow.includes('sft')) { bId = 4; batId = 52; }
                    else if (cLow.includes('comm') || cLow.includes('acc')) { bId = 6; batId = 50; }
                    else if (cLow.includes('ol') || cLow.includes('o/l')) { bId = 9; batId = 20; }
                    else if (cLow.includes('eng')) { bId = 10; batId = 53; }
                    else if (cLow.includes('law')) { bId = 18; batId = 48; }

                    const dbPhone = `${normPhone}_BIZ_${bId}_BATCH_${batId}`;
                    const bookedLead = await prisma.lead.upsert({
                        where: { phone: dbPhone },
                        update: {
                            name: fnArgs.name || undefined,
                            feedback: `Browser Voice Agent Demo Booking | Slot: ${fnArgs.slot_id} | Course: ${fnArgs.course}`,
                            callStatus: 'booked',
                            updatedAt: new Date()
                        },
                        create: {
                            name: fnArgs.name || 'Caller',
                            phone: dbPhone,
                            batchId: batId,
                            source: 'ai_voice_call',
                            campaignType: 'FREE_SEMINAR',
                            status: 'NEW',
                            phase: 1,
                            callStatus: 'booked',
                            feedback: `Browser Voice Agent Demo Booking | Slot: ${fnArgs.slot_id} | Course: ${fnArgs.course}`,
                            lastMessage: `Free Demo booked for ${fnArgs.slot_id}`,
                            lastMessageAt: new Date()
                        }
                    });

                    leadCreated = {
                        id: bookedLead.id,
                        name: bookedLead.name,
                        phone: normPhone,
                        course: fnArgs.course,
                        slot_id: fnArgs.slot_id
                    };
                    toolResult = { ok: true, leadId: bookedLead.id, message: "Lead saved successfully in IMA Campus CRM!" };
                    toolExecutions.push({ tool: fnName, args: fnArgs, leadId: bookedLead.id });
                }

                currentContents.push({
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name: fnName,
                            response: { result: toolResult }
                        }
                    }]
                });
            }
        }

        // ⚡ INSTANT KORE STUDIO AUDIO (100% Consistent Voice, never changes)
        let audioBase64 = null;
        const mimeType = 'audio/wav';
        if (finalReply) {
            try {
                const audioRes = await synthesizeAudio(finalReply);
                if (audioRes && audioRes.base64) {
                    audioBase64 = audioRes.base64;
                }
            } catch (aErr) {
                console.warn('Kore audio generation warning:', aErr.message);
            }
        }

        const ttsUrl = `/api/public/voice-agent/tts?text=${encodeURIComponent(finalReply)}`;

        res.json({
            success: true,
            reply: finalReply,
            ttsUrl,
            audioBase64,
            mimeType,
            toolExecutions,
            leadCreated,
            updatedHistory: currentContents
        });

    } catch (error) {
        console.error("Voice Agent Chat Error:", error.response?.data || error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔥 Voice AI Agent: Fetch Recent Bookings for Admin Monitoring Panel
router.get('/voice-agent/recent-bookings', async (req, res) => {
    try {
        const leads = await prisma.lead.findMany({
            where: { source: 'ai_voice_call' },
            orderBy: { createdAt: 'desc' },
            take: 15,
            select: {
                id: true,
                name: true,
                phone: true,
                status: true,
                callStatus: true,
                feedback: true,
                createdAt: true,
                batch: {
                    select: {
                        name: true,
                        business: {
                            select: { name: true }
                        }
                    }
                }
            }
        });

        res.json({ success: true, leads });
    } catch (error) {
        console.error("Recent Bookings Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔥 Voice AI Agent: Delete Test Booking (Cleanup)
router.delete('/voice-agent/booking/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await prisma.lead.delete({ where: { id } });
        res.json({ success: true, message: `Lead ${id} deleted successfully.` });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 🔥 Voice AI Agent: 100% Studio Neural Voice Generator (Kore Exclusively)
router.get('/voice-agent/tts', async (req, res) => {
    try {
        const text = req.query.text;
        if (!text) return res.status(400).send("Text is required");

        const result = await synthesizeAudio(text);
        if (!result || !result.buffer) {
            return res.status(500).send("TTS Error");
        }

        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.send(result.buffer);

    } catch (error) {
        console.error("TTS Error:", error.message);
        res.status(500).send("TTS Error");
    }
});

module.exports = router;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const claudeController = require('./claudeController');

// Secure storage paths
const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'ai_team');
const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads', 'ai-team-avatars');

// Ensure necessary directories exist
if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MEMBERS_FILE = path.join(STORAGE_DIR, 'members.json');
const TEAMS_FILE = path.join(STORAGE_DIR, 'teams.json');
const CONVERSATIONS_FILE = path.join(STORAGE_DIR, 'conversations.json');

// Default initial roster
const DEFAULT_MEMBERS = [
    {
        id: 'member-tech-lead',
        name: 'Alex Vance',
        role: 'Tech Lead',
        title: 'Principal Software Architect & Lead',
        avatar: '/uploads/ai-team-avatars/default-techlead.svg',
        systemPrompt: `You are Alex Vance, the Principal Tech Lead of the engineering team.
Your responsibilities:
- System architecture, scalability, reliability, and code quality standards.
- High-level technical decisions and engineering roadmap planning.
- Guiding and orchestrating Frontend, Backend, Cyber Security, and QA engineers.
- Conducting pragmatic code reviews and resolving architectural trade-offs.

Tone & Style:
- Decisive, technical, encouraging, and structured.
- When explaining solutions, provide architectural diagrams in text/mermaid, step-by-step implementation plans, and concrete production code.
- If other agents in the team contribute, acknowledge their points and synthesize the final technical strategy.`,
        skills: ['System Architecture', 'Code Review', 'Cloud & Scaling', 'DevOps Strategy', 'Team Orchestration'],
        badgeColor: 'violet',
        model: 'claude-3-7-sonnet',
        temperature: 0.6,
        isDefault: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'member-cyber-sec',
        name: 'Elena Rostova',
        role: 'Cyber Security Engineer',
        title: 'Senior Application Security & Threat Analyst',
        avatar: '/uploads/ai-team-avatars/default-security.svg',
        systemPrompt: `You are Elena Rostova, a Senior Cyber Security & Threat Analysis Engineer.
Your responsibilities:
- Identify and mitigate security risks: OWASP Top 10, CWE vulnerabilities, SQL injection, XSS, CSRF, broken access control, SSRF, insecure file uploads, and session hijacking.
- Enforce the Principle of Least Privilege, Zero Trust architecture, secure credential handling, and defense-in-depth.
- Audit proposed code, endpoints, database queries, and frontend rendering logic.

Tone & Style:
- Vigilant, sharp, precise, and proactive about edge cases and attack surfaces.
- Always highlight potential vulnerabilities, threat severity (Low/Medium/High/Critical), and provide the exact hardened, secure replacement code.`,
        skills: ['OWASP Top 10', 'Penetration Testing', 'AppSec Hardening', 'Zero Trust', 'Threat Modeling'],
        badgeColor: 'rose',
        model: 'claude-3-7-sonnet',
        temperature: 0.4,
        isDefault: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'member-frontend',
        name: 'Kai Takahashi',
        role: 'Frontend Developer',
        title: 'Senior Frontend Architect & UI/UX Specialist',
        avatar: '/uploads/ai-team-avatars/default-frontend.svg',
        systemPrompt: `You are Kai Takahashi, a World-Class Frontend Engineer and UI/UX Designer.
Your responsibilities:
- Build modern, ultra-responsive, beautiful web interfaces using React 19, Tailwind CSS, Lucide icons, and modern design principles.
- Maintain seamless micro-interactions, dark/light theme aesthetics, glassmorphism, and responsive layouts across all viewports.
- Manage client-side state cleanly, optimize bundle performance, and ensure web accessibility (a11y).

Tone & Style:
- Creative, user-obsessed, detail-oriented, and contemporary.
- When asked for UI or frontend code, provide complete, production-ready React components with clean Tailwind classes without placeholders or truncated snippets.`,
        skills: ['React 19', 'Tailwind CSS', 'UI/UX Design', 'Client State Management', 'Animation & Micro-interactions'],
        badgeColor: 'sky',
        model: 'claude-3-7-sonnet',
        temperature: 0.7,
        isDefault: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'member-backend',
        name: 'Rohan Patel',
        role: 'Backend Developer',
        title: 'Senior Backend & Database Engineer',
        avatar: '/uploads/ai-team-avatars/default-backend.svg',
        systemPrompt: `You are Rohan Patel, a Senior Backend & Database Systems Engineer.
Your responsibilities:
- Design robust REST & WebSocket APIs using Node.js, Express, and Prisma ORM with MySQL.
- Design normalized, high-performance database schemas, write indexed queries, and prevent slow table scans.
- Implement secure authentication (JWT / RBAC), input validation, rate limiting, and business logic pipelines.
- Ensure error resilience, logging, and concurrency control.

Tone & Style:
- Analytical, performance-minded, pragmatic, and clean.
- Provide production-grade Express/Node.js controllers, routes, and Prisma schema definitions with robust error handling.`,
        skills: ['Node.js & Express', 'Prisma ORM & MySQL', 'REST & WebSocket APIs', 'Query Optimization', 'Authentication & RBAC'],
        badgeColor: 'emerald',
        model: 'claude-3-7-sonnet',
        temperature: 0.5,
        isDefault: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'member-qa',
        name: 'Maya Lin',
        role: 'QA Engineer',
        title: 'Lead QA & Test Automation Specialist',
        avatar: '/uploads/ai-team-avatars/default-qa.svg',
        systemPrompt: `You are Maya Lin, a Principal QA & Test Automation Engineer.
Your responsibilities:
- Design comprehensive test plans, edge-case matrices, and automated test suites (Unit, Integration, E2E).
- Actively look for race conditions, boundary limit failures, unhandled exceptions, null pointer bugs, and unexpected user input behavior.
- Validate that Frontend and Backend contracts match precisely.

Tone & Style:
- Methodical, inquisitive, constructive, and uncompromising on quality.
- Highlight specific failure modes, provide test scenarios, and write Jest/Playwright/Cypress test blocks.`,
        skills: ['Test Automation', 'Edge Case Analysis', 'Regression Testing', 'Jest / Playwright', 'Contract Testing'],
        badgeColor: 'amber',
        model: 'claude-3-7-sonnet',
        temperature: 0.5,
        isDefault: true,
        createdAt: new Date().toISOString()
    }
];

// Default initial teams
const DEFAULT_TEAMS = [
    {
        id: 'team-core-dev',
        name: 'Core Engineering Squad',
        description: 'Complete full-stack development squad: Tech Lead, Cyber Security, Frontend, Backend, and QA.',
        icon: '🚀',
        badgeColor: 'indigo',
        memberIds: ['member-tech-lead', 'member-cyber-sec', 'member-frontend', 'member-backend', 'member-qa'],
        isDefault: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'team-security-infra',
        name: 'Security & Architecture Squad',
        description: 'Focused team for code hardening, vulnerability auditing, database design, and cloud scalability.',
        icon: '🛡️',
        badgeColor: 'rose',
        memberIds: ['member-tech-lead', 'member-cyber-sec', 'member-backend'],
        isDefault: true,
        createdAt: new Date().toISOString()
    },
    {
        id: 'team-frontend-qa',
        name: 'UI/UX & Quality Squad',
        description: 'Dedicated to frontend implementation, user experience design, and edge case testing.',
        icon: '✨',
        badgeColor: 'cyan',
        memberIds: ['member-frontend', 'member-qa', 'member-tech-lead'],
        isDefault: true,
        createdAt: new Date().toISOString()
    }
];

// File helper functions with atomic writes
const readJsonFile = (filePath, defaultData) => {
    try {
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
            return defaultData;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`[AI Team] Error reading ${filePath}:`, err.message);
        return defaultData;
    }
};

const writeJsonFile = (filePath, data) => {
    try {
        const tempPath = `${filePath}.tmp.${Date.now()}`;
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, filePath);
        return true;
    } catch (err) {
        console.error(`[AI Team] Error writing ${filePath}:`, err.message);
        return false;
    }
};

// Seed default avatars if needed
const seedDefaultAvatars = () => {
    const avatarPresets = {
        'default-techlead.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient></defs><rect width="100" height="100" rx="30" fill="url(#g1)"/><circle cx="50" cy="38" r="18" fill="#ffffff" opacity="0.95"/><path d="M22 82 C22 62, 38 56, 50 56 C62 56, 78 62, 78 82 Z" fill="#ffffff" opacity="0.95"/><circle cx="50" cy="38" r="8" fill="#8b5cf6"/><path d="M46 36 L54 36 M50 32 L50 40" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`,
        'default-security.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f43f5e"/><stop offset="100%" stop-color="#be123c"/></linearGradient></defs><rect width="100" height="100" rx="30" fill="url(#g2)"/><path d="M50 20 L74 30 V50 C74 65, 63 76, 50 82 C37 76, 26 65, 26 50 V30 Z" fill="#ffffff" opacity="0.95"/><path d="M50 35 L62 41 V52 C62 60, 57 66, 50 70 C43 66, 38 60, 38 52 V41 Z" fill="#f43f5e"/><circle cx="50" cy="51" r="4" fill="#ffffff"/></svg>`,
        'default-frontend.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0ea5e9"/><stop offset="100%" stop-color="#0284c7"/></linearGradient></defs><rect width="100" height="100" rx="30" fill="url(#g3)"/><rect x="22" y="26" width="56" height="48" rx="8" fill="#ffffff" opacity="0.95"/><path d="M22 36 H78" stroke="#0ea5e9" stroke-width="2"/><circle cx="30" cy="31" r="2.5" fill="#0ea5e9"/><circle cx="38" cy="31" r="2.5" fill="#38bdf8"/><path d="M38 52 L32 57 L38 62 M62 52 L68 57 L62 62 M53 48 L47 66" stroke="#0284c7" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
        'default-backend.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#10b981"/><stop offset="100%" stop-color="#047857"/></linearGradient></defs><rect width="100" height="100" rx="30" fill="url(#g4)"/><ellipse cx="50" cy="30" rx="26" ry="10" fill="#ffffff" opacity="0.95"/><path d="M24 30 V50 C24 56, 36 60, 50 60 C64 60, 76 56, 76 50 V30" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.95"/><path d="M24 50 V70 C24 76, 36 80, 50 80 C64 80, 76 76, 76 70 V50" fill="none" stroke="#ffffff" stroke-width="5" opacity="0.95"/><circle cx="50" cy="50" r="3" fill="#10b981"/></svg>`,
        'default-qa.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f59e0b"/><stop offset="100%" stop-color="#d97706"/></linearGradient></defs><rect width="100" height="100" rx="30" fill="url(#g5)"/><circle cx="50" cy="50" r="28" fill="#ffffff" opacity="0.95"/><path d="M36 50 L46 60 L66 40" stroke="#d97706" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="50" cy="50" r="33" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="6,4"/></svg>`
    };

    for (const [filename, svgContent] of Object.entries(avatarPresets)) {
        const dest = path.join(UPLOAD_DIR, filename);
        if (!fs.existsSync(dest)) {
            try {
                fs.writeFileSync(dest, svgContent, 'utf8');
            } catch (err) {
                console.warn(`[AI Team] Failed to write preset ${filename}:`, err.message);
            }
        }
    }
};

seedDefaultAvatars();

// Helper to call Claude / Anthropic via claudeController or fallback
const callAnthropicLlm = async ({ messages, systemPrompt, model = 'claude-3-7-sonnet', temperature = 0.7, anthropicApiKey = '' }) => {
    return new Promise((resolve, reject) => {
        const mockReq = {
            body: {
                messages,
                systemPrompt,
                model: model || 'claude-3-7-sonnet',
                temperature: parseFloat(temperature) || 0.7,
                maxTokens: 8192,
                anthropicApiKey: anthropicApiKey || ''
            }
        };

        const mockRes = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                if (data.error && !data.success && !data.text) {
                    reject(new Error(data.error));
                } else {
                    resolve(data);
                }
            }
        };

        claudeController.handleChat(mockReq, mockRes).catch(reject);
    });
};

// Helper to ensure messages strictly alternate and end in 'user' for Anthropic API
const formatMessagesForAnthropic = (rawMessages, targetMemberName = '', targetMemberRole = '') => {
    const formatted = [];
    for (const item of rawMessages) {
        const role = item.role === 'user' ? 'user' : 'assistant';
        const text = typeof item.content === 'string' ? item.content : JSON.stringify(item.content || '');
        
        if (formatted.length === 0) {
            formatted.push({ role: 'user', content: text });
        } else {
            const last = formatted[formatted.length - 1];
            if (last.role === role) {
                last.content += `\n\n${text}`;
            } else {
                formatted.push({ role, content: text });
            }
        }
    }

    // Anthropic requires the final message to be from 'user'
    if (formatted.length > 0 && formatted[formatted.length - 1].role !== 'user') {
        const promptNote = targetMemberName 
            ? `Please review the team dialogue above and provide your insights as ${targetMemberName} (${targetMemberRole || 'Specialist'}).`
            : 'Please review the team dialogue above and provide your response.';
        formatted.push({ role: 'user', content: promptNote });
    }

    return formatted;
};

// ==========================================
// CONTROLLER ACTIONS
// ==========================================

/**
 * GET /api/ai-team/members
 */
exports.getMembers = async (req, res) => {
    try {
        const members = readJsonFile(MEMBERS_FILE, DEFAULT_MEMBERS);
        return res.json({ success: true, members });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch AI team members' });
    }
};

/**
 * POST /api/ai-team/members
 */
exports.createMember = async (req, res) => {
    try {
        const { name, role, title, avatar, systemPrompt, skills = [], badgeColor = 'violet', model = 'claude-3-7-sonnet', temperature = 0.7 } = req.body;
        
        if (!name || !role || !systemPrompt) {
            return res.status(400).json({ error: 'Name, Role, and System Prompt are required.' });
        }

        const members = readJsonFile(MEMBERS_FILE, DEFAULT_MEMBERS);
        const newMember = {
            id: `member-${crypto.randomUUID().slice(0, 8)}`,
            name: String(name).trim().slice(0, 100),
            role: String(role).trim().slice(0, 100),
            title: String(title || role).trim().slice(0, 150),
            avatar: avatar || '/uploads/ai-team-avatars/default-techlead.svg',
            systemPrompt: String(systemPrompt).trim(),
            skills: Array.isArray(skills) ? skills.slice(0, 20) : String(skills).split(',').map(s => s.trim()).filter(Boolean).slice(0, 20),
            badgeColor: badgeColor || 'violet',
            model: model || 'claude-3-7-sonnet',
            temperature: parseFloat(temperature) || 0.7,
            isDefault: false,
            createdAt: new Date().toISOString()
        };

        members.push(newMember);
        writeJsonFile(MEMBERS_FILE, members);

        return res.json({ success: true, member: newMember });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to create AI member' });
    }
};

/**
 * PUT /api/ai-team/members/:id
 */
exports.updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, title, avatar, systemPrompt, skills, badgeColor, model, temperature } = req.body;

        const members = readJsonFile(MEMBERS_FILE, DEFAULT_MEMBERS);
        const index = members.findIndex(m => m.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'AI member not found.' });
        }

        const current = members[index];
        const updated = {
            ...current,
            name: name !== undefined ? String(name).trim().slice(0, 100) : current.name,
            role: role !== undefined ? String(role).trim().slice(0, 100) : current.role,
            title: title !== undefined ? String(title).trim().slice(0, 150) : current.title,
            avatar: avatar !== undefined ? avatar : current.avatar,
            systemPrompt: systemPrompt !== undefined ? String(systemPrompt).trim() : current.systemPrompt,
            skills: skills !== undefined ? (Array.isArray(skills) ? skills.slice(0, 20) : String(skills).split(',').map(s => s.trim()).filter(Boolean).slice(0, 20)) : current.skills,
            badgeColor: badgeColor !== undefined ? badgeColor : current.badgeColor,
            model: model !== undefined ? model : current.model,
            temperature: temperature !== undefined ? parseFloat(temperature) : current.temperature,
            updatedAt: new Date().toISOString()
        };

        members[index] = updated;
        writeJsonFile(MEMBERS_FILE, members);

        return res.json({ success: true, member: updated });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update AI member' });
    }
};

/**
 * DELETE /api/ai-team/members/:id
 */
exports.deleteMember = async (req, res) => {
    try {
        const { id } = req.params;
        let members = readJsonFile(MEMBERS_FILE, DEFAULT_MEMBERS);

        const member = members.find(m => m.id === id);
        if (!member) {
            return res.status(404).json({ error: 'AI member not found.' });
        }

        members = members.filter(m => m.id !== id);
        writeJsonFile(MEMBERS_FILE, members);

        // Also remove member from any teams
        const teams = readJsonFile(TEAMS_FILE, DEFAULT_TEAMS);
        let teamsModified = false;
        teams.forEach(t => {
            if (t.memberIds && t.memberIds.includes(id)) {
                t.memberIds = t.memberIds.filter(mId => mId !== id);
                teamsModified = true;
            }
        });
        if (teamsModified) {
            writeJsonFile(TEAMS_FILE, teams);
        }

        return res.json({ success: true, message: 'AI member deleted successfully.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to delete AI member' });
    }
};

/**
 * GET /api/ai-team/teams
 */
exports.getTeams = async (req, res) => {
    try {
        const teams = readJsonFile(TEAMS_FILE, DEFAULT_TEAMS);
        return res.json({ success: true, teams });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch AI teams' });
    }
};

/**
 * POST /api/ai-team/teams
 */
exports.createTeam = async (req, res) => {
    try {
        const { name, description = '', icon = '👥', badgeColor = 'indigo', memberIds = [] } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Team name is required.' });
        }

        const teams = readJsonFile(TEAMS_FILE, DEFAULT_TEAMS);
        const newTeam = {
            id: `team-${crypto.randomUUID().slice(0, 8)}`,
            name: String(name).trim().slice(0, 100),
            description: String(description).trim().slice(0, 300),
            icon: icon || '👥',
            badgeColor: badgeColor || 'indigo',
            memberIds: Array.isArray(memberIds) ? memberIds : [],
            isDefault: false,
            createdAt: new Date().toISOString()
        };

        teams.push(newTeam);
        writeJsonFile(TEAMS_FILE, teams);

        return res.json({ success: true, team: newTeam });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to create AI team' });
    }
};

/**
 * PUT /api/ai-team/teams/:id
 */
exports.updateTeam = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, icon, badgeColor, memberIds } = req.body;

        const teams = readJsonFile(TEAMS_FILE, DEFAULT_TEAMS);
        const index = teams.findIndex(t => t.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Team not found.' });
        }

        const current = teams[index];
        const updated = {
            ...current,
            name: name !== undefined ? String(name).trim().slice(0, 100) : current.name,
            description: description !== undefined ? String(description).trim().slice(0, 300) : current.description,
            icon: icon !== undefined ? icon : current.icon,
            badgeColor: badgeColor !== undefined ? badgeColor : current.badgeColor,
            memberIds: memberIds !== undefined ? memberIds : current.memberIds,
            updatedAt: new Date().toISOString()
        };

        teams[index] = updated;
        writeJsonFile(TEAMS_FILE, teams);

        return res.json({ success: true, team: updated });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to update AI team' });
    }
};

/**
 * DELETE /api/ai-team/teams/:id
 */
exports.deleteTeam = async (req, res) => {
    try {
        const { id } = req.params;
        let teams = readJsonFile(TEAMS_FILE, DEFAULT_TEAMS);

        const team = teams.find(t => t.id === id);
        if (!team) {
            return res.status(404).json({ error: 'Team not found.' });
        }

        teams = teams.filter(t => t.id !== id);
        writeJsonFile(TEAMS_FILE, teams);

        return res.json({ success: true, message: 'Team deleted successfully.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to delete AI team' });
    }
};

/**
 * GET /api/ai-team/conversations/:id
 */
exports.getConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const conversations = readJsonFile(CONVERSATIONS_FILE, {});
        const history = conversations[id] || [];
        return res.json({ success: true, history });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to fetch conversation history' });
    }
};

/**
 * DELETE /api/ai-team/conversations/:id
 */
exports.clearConversation = async (req, res) => {
    try {
        const { id } = req.params;
        const conversations = readJsonFile(CONVERSATIONS_FILE, {});
        conversations[id] = [];
        writeJsonFile(CONVERSATIONS_FILE, conversations);
        return res.json({ success: true, message: 'Conversation cleared.' });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to clear conversation' });
    }
};

/**
 * POST /api/ai-team/upload-avatar
 */
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded.' });
        }

        const safeFilename = path.basename(req.file.filename);
        const avatarUrl = `/uploads/ai-team-avatars/${safeFilename}`;

        return res.json({
            success: true,
            avatarUrl,
            filename: safeFilename
        });
    } catch (err) {
        console.error('[AI Team Avatar Upload Error]:', err.message);
        return res.status(500).json({ error: 'Failed to upload avatar image' });
    }
};

/**
 * POST /api/ai-team/chat
 * Multi-Agent discussion & 1-on-1 interaction endpoint
 */
exports.handleChat = async (req, res) => {
    try {
        const {
            chatType = 'direct', // 'direct' | 'team'
            targetId,           // memberId or teamId
            message,
            mentionedMemberIds = [],
            anthropicApiKey = '',
            selectedModel = '',
            discussionMode = 'smart' // 'smart' | 'all' | 'lead'
        } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ error: 'Message cannot be empty.' });
        }
        if (!targetId) {
            return res.status(400).json({ error: 'Target ID (member or team) is required.' });
        }

        const members = readJsonFile(MEMBERS_FILE, DEFAULT_MEMBERS);
        const teams = readJsonFile(TEAMS_FILE, DEFAULT_TEAMS);
        const conversations = readJsonFile(CONVERSATIONS_FILE, {});

        if (!conversations[targetId]) {
            conversations[targetId] = [];
        }
        const history = conversations[targetId];

        // Format user message
        const userMsgObj = {
            id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
            role: 'user',
            sender: {
                name: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName || ''}`.trim() : 'Project Lead',
                role: 'USER',
                avatar: null
            },
            content: message.trim(),
            timestamp: new Date().toISOString()
        };
        history.push(userMsgObj);

        // =====================================
        // MODE 1: DIRECT (1-on-1) CHAT
        // =====================================
        if (chatType === 'direct') {
            const member = members.find(m => m.id === targetId);
            if (!member) {
                return res.status(404).json({ error: 'AI member not found.' });
            }

            // Format strictly alternating messages for Anthropic
            const llmMessages = formatMessagesForAnthropic(history, member.name, member.role);

            // Call Claude
            const responseData = await callAnthropicLlm({
                messages: llmMessages,
                systemPrompt: member.systemPrompt,
                model: selectedModel || member.model || 'claude-3-7-sonnet',
                temperature: member.temperature || 0.7,
                anthropicApiKey
            });

            const replyText = responseData.text || '';
            const replyMsgObj = {
                id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
                role: 'assistant',
                sender: {
                    id: member.id,
                    name: member.name,
                    role: member.role,
                    title: member.title,
                    avatar: member.avatar,
                    badgeColor: member.badgeColor
                },
                content: replyText,
                model: responseData.model || member.model,
                provider: responseData.provider || 'Anthropic API',
                timestamp: new Date().toISOString()
            };

            history.push(replyMsgObj);
            // Keep last 100 messages per conversation
            if (history.length > 100) {
                conversations[targetId] = history.slice(-100);
            } else {
                conversations[targetId] = history;
            }
            writeJsonFile(CONVERSATIONS_FILE, conversations);

            return res.json({
                success: true,
                replies: [replyMsgObj],
                history: conversations[targetId]
            });
        }

        // =====================================
        // MODE 2: TEAM (GROUP) CHAT
        // =====================================
        const team = teams.find(t => t.id === targetId);
        if (!team) {
            return res.status(404).json({ error: 'Team not found.' });
        }

        const teamMembers = members.filter(m => team.memberIds.includes(m.id));
        if (teamMembers.length === 0) {
            return res.status(400).json({ error: 'No members currently assigned to this team.' });
        }

        // Determine which members should reply
        let targetMembers = [];

        // Check explicit mentioned IDs
        if (Array.isArray(mentionedMemberIds) && mentionedMemberIds.length > 0) {
            targetMembers = teamMembers.filter(m => mentionedMemberIds.includes(m.id));
        }

        // Check if user typed @Mention in the message text itself
        if (targetMembers.length === 0) {
            const lowerMsg = message.toLowerCase();
            targetMembers = teamMembers.filter(m => {
                const namePart = m.name.toLowerCase().split(' ')[0];
                const roleLower = m.role.toLowerCase().replace(/\s+/g, '');
                return lowerMsg.includes(`@${namePart}`) || 
                       lowerMsg.includes(`@${m.name.toLowerCase()}`) || 
                       lowerMsg.includes(`@${roleLower}`) ||
                       lowerMsg.includes(`@${m.role.toLowerCase()}`);
            });
        }

        // If no mention found:
        if (targetMembers.length === 0) {
            if (discussionMode === 'all') {
                // All team members contribute
                targetMembers = teamMembers;
            } else {
                // By default, Tech Lead leads the discussion, or first team member
                const techLead = teamMembers.find(m => m.role.toLowerCase().includes('lead') || m.id.includes('tech-lead')) || teamMembers[0];
                targetMembers = [techLead];
            }
        }

        // Execute sequential responses so subsequent agents have context of prior agents' replies!
        const generatedReplies = [];

        for (const member of targetMembers) {
            // Build conversation history including all previous messages + newly generated replies in this turn
            const rawContextMessages = history.map(item => ({
                role: item.role === 'user' ? 'user' : 'assistant',
                content: item.role === 'user'
                    ? `${item.sender?.name || 'User'}: ${item.content}`
                    : `[${item.sender?.name || 'Agent'} - ${item.sender?.role || 'Engineer'}]: ${item.content}`
            }));

            const contextMessages = formatMessagesForAnthropic(rawContextMessages, member.name, member.role);

            // Team collaboration system prompt enhancement
            const teamContextPrompt = `${member.systemPrompt}

TEAM COLLABORATION CONTEXT:
You are actively collaborating with your engineering team in group "${team.name}".
Other members in this squad: ${teamMembers.map(m => `${m.name} (${m.role})`).join(', ')}.
Address the user's prompt from your specific domain expertise as ${member.role}.
Build upon other team members' remarks if they have already spoken. Keep your response focused, insightful, high-value, and production-grade.`;

            try {
                const responseData = await callAnthropicLlm({
                    messages: contextMessages,
                    systemPrompt: teamContextPrompt,
                    model: selectedModel || member.model || 'claude-3-7-sonnet',
                    temperature: member.temperature || 0.7,
                    anthropicApiKey
                });

                const replyText = responseData.text || '';
                const agentReplyObj = {
                    id: `msg-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
                    role: 'assistant',
                    sender: {
                        id: member.id,
                        name: member.name,
                        role: member.role,
                        title: member.title,
                        avatar: member.avatar,
                        badgeColor: member.badgeColor
                    },
                    content: replyText,
                    model: responseData.model || member.model,
                    provider: responseData.provider || 'Anthropic API',
                    timestamp: new Date().toISOString()
                };

                // Add to ongoing history for the next agent in sequence
                history.push(agentReplyObj);
                generatedReplies.push(agentReplyObj);

            } catch (agentErr) {
                console.warn(`[AI Team] Error generating reply for ${member.name}:`, agentErr.message);
            }
        }

        // Cap history to 100 messages
        if (history.length > 100) {
            conversations[targetId] = history.slice(-100);
        } else {
            conversations[targetId] = history;
        }
        writeJsonFile(CONVERSATIONS_FILE, conversations);

        return res.json({
            success: true,
            replies: generatedReplies,
            history: conversations[targetId]
        });

    } catch (err) {
        console.error('[AI Team Chat Error]:', err);
        return res.status(500).json({
            error: err.message || 'Internal server error while processing AI team chat.'
        });
    }
};

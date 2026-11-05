const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const saPath = path.join(__dirname, '..', 'gemini-service-account.json');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
let cachedSchema = null;

const getSchema = () => {
    if (!cachedSchema) {
        if (fs.existsSync(schemaPath)) {
            const rawSchema = fs.readFileSync(schemaPath, 'utf8');
            // Remove comments and blank lines to save tokens
            cachedSchema = rawSchema.split('\n').filter(line => !line.trim().startsWith('//') && line.trim() !== '').join('\n');
        } else {
            cachedSchema = "Schema not found.";
        }
    }
    return cachedSchema;
};

const systemInstruction = `You are the IMA Campus System Admin AI Assistant. You are an expert data analyst and database administrator.
You have access to the MySQL database via the 'executeSQL' tool. 
When asked a question, generate an appropriate MySQL query, use the 'executeSQL' tool to run it, and then formulate a clear, user-friendly answer based on the retrieved data.
NEVER execute destructive queries (e.g., DROP, DELETE, UPDATE, INSERT, TRUNCATE). Only use SELECT queries.
The database schema is as follows:

${getSchema()}

IMPORTANT RULES FOR PAYMENTS:
- Pending Payments: status = 0 AND method != 'Upcoming'
- Upcoming Payments: status = 0 AND method = 'Upcoming'
- Approved Payments: status = 1
- Rejected Payments: status = 2
- Trash/Deleted Payments: status = 5
Always use these exact conditions when answering questions about payment counts or amounts.
`;

const tools = [
    {
        functionDeclarations: [
            {
                name: "executeSQL",
                description: "Execute a MySQL SELECT query on the IMA Campus database to retrieve information.",
                parameters: {
                    type: "OBJECT",
                    properties: {
                        query: {
                            type: "STRING",
                            description: "The raw MySQL SELECT query. Example: SELECT * FROM User WHERE role = 'Student' LIMIT 10;"
                        }
                    },
                    required: ["query"]
                }
            }
        ]
    }
];

const getAccessToken = async () => {
    if (!fs.existsSync(saPath)) throw new Error("Service Account JSON not found!");
    const auth = new GoogleAuth({
        keyFile: saPath,
        scopes: ['https://www.googleapis.com/auth/generative-language']
    });
    const client = await auth.getClient();
    const tokenInfo = await client.getAccessToken();
    return tokenInfo.token;
};

const executeSQL = async (query) => {
    // Basic security check
    const upperQuery = query.trim().toUpperCase();
    if (!upperQuery.startsWith('SELECT')) {
        throw new Error("Only SELECT queries are allowed for security reasons.");
    }
    const badKeywords = ['DROP', 'DELETE', 'UPDATE', 'INSERT', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
    for (const kw of badKeywords) {
        // Simple regex to find isolated keywords
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(query)) {
            throw new Error(`Query blocked due to prohibited keyword: ${kw}`);
        }
    }

    try {
        const results = await prisma.$queryRawUnsafe(query);
        // Stringify BigInts if any
        const safeResults = JSON.parse(JSON.stringify(results, (key, value) =>
            typeof value === 'bigint' ? value.toString() : value
        ));
        return safeResults;
    } catch (error) {
        return { error: error.message };
    }
};

exports.handleChat = async (req, res) => {
    try {
        const { message, history = [] } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required" });

        const token = await getAccessToken();
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

        // Prepare conversation history for Gemini API format
        const contents = [];
        
        // Add previous history
        history.forEach(msg => {
            contents.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            });
        });
        
        // Add current message
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        let MAX_ITERATIONS = 5;
        let iteration = 0;
        let finalResponseText = "";

        while (iteration < MAX_ITERATIONS) {
            iteration++;
            
            const payload = {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents,
                tools
            };

            const response = await axios.post(apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const candidate = response.data.candidates[0];
            const parts = candidate.content.parts;
            
            // Check if there's a function call
            const functionCallPart = parts.find(p => p.functionCall);
            
            if (functionCallPart) {
                const call = functionCallPart.functionCall;
                if (call.name === 'executeSQL') {
                    const query = call.args.query;
                    console.log("[AI Agent] Executing SQL:", query);
                    
                    const queryResult = await executeSQL(query);
                    
                    // Add the model's function call to contents
                    contents.push({
                        role: 'model',
                        parts: [functionCallPart]
                    });
                    
                    // Add the function response to contents
                    contents.push({
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name: 'executeSQL',
                                response: {
                                    result: queryResult
                                }
                            }
                        }]
                    });
                } else {
                    throw new Error(`Unknown function call: ${call.name}`);
                }
            } else {
                // No function call, we have the final text response
                finalResponseText = parts.find(p => p.text)?.text || "";
                break;
            }
        }

        if (iteration >= MAX_ITERATIONS && !finalResponseText) {
            finalResponseText = "I had to stop thinking because it took too long. Please try a simpler question.";
        }

        return res.json({ response: finalResponseText });

    } catch (error) {
        console.error("AI Agent Chat Error:", error.response?.data || error);
        return res.status(500).json({ error: "Failed to process chat request." });
    }
};

exports.handleStudentBotMessage = async (inquiryId, businessId, message, studentId, replyToId) => {
    try {
        console.log(`[AI Agent] Triggered for Student ${studentId}, Inquiry ${inquiryId}`);

        // Get student info
        const student = await prisma.user.findUnique({
            where: { id: parseInt(studentId) },
            select: { firstName: true, lastName: true, id: true }
        });
        if (!student) return;

        // Fetch last 5 messages for context
        const recentMessages = await prisma.webInquiryMessage.findMany({
            where: { inquiryId: parseInt(inquiryId) },
            orderBy: { createdAt: 'desc' },
            take: 5
        });
        recentMessages.reverse();

        const token = await getAccessToken();
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

        const contents = [];
        
        recentMessages.forEach(msg => {
            if (msg.message !== message) { 
                contents.push({
                    role: msg.senderType === 'SYSTEM' && msg.senderName === 'IMA AI Bot' ? 'model' : 'user',
                    parts: [{ text: `${msg.senderName || 'Student'}: ${msg.message}` }]
                });
            }
        });

        // Add the current trigger message
        contents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        const studentSystemInstruction = `You are the IMA Campus AI Assistant. Your name is 'IMA AI Bot'.
You are currently helping a student named ${student.firstName} ${student.lastName} (Student ID: ${student.id}).
You have access to the MySQL database via the 'executeSQL' tool. 
When asked a question, generate an appropriate MySQL query, use the 'executeSQL' tool to run it, and then formulate a clear, friendly, and helpful answer for the student based on the retrieved data.
NEVER execute destructive queries. Only use SELECT queries.
If you need to check payments or leads, always filter by the student's ID (studentId = ${student.id}) unless explicitly asked otherwise.
Answer in a polite and professional tone. Keep responses reasonably concise.
The database schema is as follows:

${getSchema()}

IMPORTANT RULES FOR PAYMENTS:
- Pending Payments: status = 0 AND method != 'Upcoming'
- Upcoming Payments: status = 0 AND method = 'Upcoming'
- Approved Payments: status = 1
- Rejected Payments: status = 2
- Trash/Deleted Payments: status = 5
`;

        let MAX_ITERATIONS = 5;
        let iteration = 0;
        let finalResponseText = "";

        while (iteration < MAX_ITERATIONS) {
            iteration++;
            
            const payload = {
                systemInstruction: { parts: [{ text: studentSystemInstruction }] },
                contents,
                tools
            };

            const response = await axios.post(apiUrl, payload, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const candidate = response.data.candidates[0];
            const parts = candidate.content.parts;
            
            const functionCallPart = parts.find(p => p.functionCall);
            
            if (functionCallPart) {
                const call = functionCallPart.functionCall;
                if (call.name === 'executeSQL') {
                    const query = call.args.query;
                    console.log("[AI Agent Student Bot] Executing SQL:", query);
                    
                    const queryResult = await executeSQL(query);
                    
                    contents.push({
                        role: 'model',
                        parts: [functionCallPart]
                    });
                    
                    contents.push({
                        role: 'user',
                        parts: [{
                            functionResponse: {
                                name: 'executeSQL',
                                response: {
                                    result: queryResult
                                }
                            }
                        }]
                    });
                } else {
                    console.error(`Unknown function call: ${call.name}`);
                    break;
                }
            } else {
                finalResponseText = parts.find(p => p.text)?.text || "";
                break;
            }
        }

        if (iteration >= MAX_ITERATIONS && !finalResponseText) {
            finalResponseText = "I'm sorry, I'm having trouble retrieving that information right now. Please wait for a staff member to assist you.";
        }

        // Save AI reply to database
        const savedMsg = await prisma.webInquiryMessage.create({
            data: {
                inquiryId: parseInt(inquiryId),
                message: finalResponseText,
                direction: 'outbound',
                senderType: 'SYSTEM',
                senderId: null, 
                senderName: 'IMA AI Bot',
                replyToId: replyToId ? parseInt(replyToId) : null,
            },
            include: {
                senderUser: { select: { firstName: true, lastName: true, role: true } },
                replyTo: { select: { message: true, mediaUrl: true, senderName: true } }
            }
        });

        // Update inquiry
        const updatedInq = await prisma.webInquiry.update({
            where: { id: parseInt(inquiryId) },
            data: {
                lastMessage: finalResponseText.substring(0, 50),
                lastMessageAt: new Date()
            }
        });

        // Emit Socket.io events
        const { getIo } = require('./chatController');
        const io = getIo();
        if (io) {
            io.to(`web_inquiry_${inquiryId}`).emit("new_web_inquiry_message", savedMsg);

            if (businessId) {
                io.to(`web_inquiry_staff_${businessId}`).emit("web_inquiry_notification", {
                    inquiryId: updatedInq.id,
                    businessId: updatedInq.businessId,
                    message: savedMsg
                });
            }
            
            if (updatedInq.studentId) {
                io.to(`user_${updatedInq.studentId}`).emit("web_inquiry_student_notification", {
                    inquiryId: updatedInq.id,
                    businessId: updatedInq.businessId,
                    message: savedMsg
                });
            }
        }

    } catch (error) {
        console.error("AI Agent Student Bot Error:", error.response?.data || error);
    }
};

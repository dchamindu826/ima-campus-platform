const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * Dynamically extract and query targeted live stats for requested business & batch
 */
async function getLiveTargetedStats(message = '', currentContext = {}) {
    try {
        const msgLower = (message || '').toLowerCase();
        
        // 1. Resolve Target Business
        let targetBizId = currentContext.selectedBusinessId !== 'ALL' && currentContext.selectedBusinessId 
            ? parseInt(currentContext.selectedBusinessId) 
            : (currentContext.selectedBusiness?.id ? parseInt(currentContext.selectedBusiness.id) : 1);

        const allBusinesses = await prisma.business.findMany({
            include: { batches: { select: { id: true, name: true } } }
        });

        // Check if message mentions another business
        for (const b of allBusinesses) {
            const bNameLower = b.name.toLowerCase();
            if (msgLower.includes('commerce') && bNameLower.includes('commerce')) targetBizId = b.id;
            else if ((msgLower.includes('art') || msgLower.includes('කලා')) && bNameLower.includes('art')) targetBizId = b.id;
            else if ((msgLower.includes('tech') || msgLower.includes('තාක්ෂණ')) && bNameLower.includes('tech')) targetBizId = b.id;
        }

        const activeBiz = allBusinesses.find(b => b.id === targetBizId) || allBusinesses[0];

        // 2. Resolve Target Batch
        let targetBatchId = null;
        if (currentContext.selectedBatchId && currentContext.selectedBatchId !== 'ALL') {
            targetBatchId = parseInt(currentContext.selectedBatchId);
        } else if (currentContext.selectedBatch?.id && currentContext.selectedBatch.id !== 'ALL') {
            targetBatchId = parseInt(currentContext.selectedBatch.id);
        }

        // Check if message explicitly mentions a batch month (e.g. august, september, july, may)
        for (const b of activeBiz.batches) {
            const bNameLower = b.name.toLowerCase();
            if (msgLower.includes('august') || msgLower.includes('aug') || msgLower.includes('අගෝස්තු')) {
                if (bNameLower.includes('august') || bNameLower.includes('aug')) targetBatchId = b.id;
            } else if (msgLower.includes('september') || msgLower.includes('sep') || msgLower.includes('සැප්තැම්බර්')) {
                if (bNameLower.includes('september') || bNameLower.includes('sep')) targetBatchId = b.id;
            } else if (msgLower.includes('july') || msgLower.includes('ජූලි')) {
                if (bNameLower.includes('july')) targetBatchId = b.id;
            } else if (msgLower.includes('may') || msgLower.includes('මැයි')) {
                if (bNameLower.includes('may')) targetBatchId = b.id;
            }
        }

        const activeBatch = activeBiz.batches.find(b => b.id === targetBatchId) || null;

        // 3. Query Real-Time Lead Stats for Target Scope
        const batchIdsInScope = targetBatchId ? [targetBatchId] : activeBiz.batches.map(b => b.id);
        
        const leads = await prisma.lead.findMany({
            where: {
                batchId: { in: batchIdsInScope }
            },
            select: {
                id: true,
                phone: true,
                campaignType: true,
                callStatus: true,
                status: true,
                batchId: true,
                assignedTo: true,
                assignedUser: {
                    select: { id: true, firstName: true, lastName: true, role: true }
                }
            }
        });

        // Compute Free Seminar Specific Stats
        const freeSemLeads = leads.filter(l => l.campaignType === 'FREE_SEMINAR');
        const afterSemLeads = leads.filter(l => l.campaignType === 'AFTER_SEMINAR');

        const freeSemCoordinatorMap = {};
        let freeSemPending = 0;
        let freeSemAnswered = 0;
        let freeSemNoAnswer = 0;
        let freeSemRejected = 0;
        let freeSemUnassigned = 0;

        freeSemLeads.forEach(l => {
            const isPending = !l.callStatus || l.callStatus === 'PENDING' || l.callStatus === 'NOT_CALLED';
            if (isPending) freeSemPending++;
            if (l.callStatus === 'ANSWERED') freeSemAnswered++;
            if (l.callStatus === 'NO_ANSWER') freeSemNoAnswer++;
            if (l.callStatus === 'REJECTED') freeSemRejected++;

            if (!l.assignedTo) {
                freeSemUnassigned++;
            } else {
                const name = l.assignedUser ? `${l.assignedUser.firstName} ${l.assignedUser.lastName || ''}`.trim() : `User #${l.assignedTo}`;
                const role = l.assignedUser?.role || 'Coordinator';
                if (!freeSemCoordinatorMap[name]) {
                    freeSemCoordinatorMap[name] = {
                        name,
                        role,
                        assignedLeads: 0,
                        coveredLeads: 0,
                        pendingLeads: 0,
                        answered: 0,
                        noAnswer: 0,
                        rejected: 0,
                        responseRate: '0%'
                    };
                }
                freeSemCoordinatorMap[name].assignedLeads++;
                if (isPending) {
                    freeSemCoordinatorMap[name].pendingLeads++;
                } else {
                    freeSemCoordinatorMap[name].coveredLeads++;
                    if (l.callStatus === 'ANSWERED') freeSemCoordinatorMap[name].answered++;
                    if (l.callStatus === 'NO_ANSWER') freeSemCoordinatorMap[name].noAnswer++;
                    if (l.callStatus === 'REJECTED') freeSemCoordinatorMap[name].rejected++;
                }
            }
        });

        Object.values(freeSemCoordinatorMap).forEach(c => {
            c.responseRate = c.coveredLeads > 0 ? `${((c.answered / c.coveredLeads) * 100).toFixed(1)}%` : '0%';
        });

        // Compute Verified Payments
        const verifiedPaymentsCount = await prisma.payment.count({
            where: {
                status: 1,
                businessId: activeBiz.id,
                ...(targetBatchId ? { batchId: targetBatchId } : { batchId: { in: batchIdsInScope } })
            }
        });

        return {
            activeBusiness: { id: activeBiz.id, name: activeBiz.name },
            activeBatch: activeBatch ? { id: activeBatch.id, name: activeBatch.name } : { id: 'ALL', name: `All Batches (${activeBiz.batches.length} batches)` },
            availableBatches: activeBiz.batches,
            freeSeminarMetrics: {
                totalLeads: freeSemLeads.length,
                assignedLeads: freeSemLeads.length - freeSemUnassigned,
                unassignedLeads: freeSemUnassigned,
                coveredLeads: freeSemLeads.length - freeSemPending,
                pendingLeads: freeSemPending,
                answeredLeads: freeSemAnswered,
                noAnswerLeads: freeSemNoAnswer,
                rejectedLeads: freeSemRejected,
                overallResponseRate: freeSemLeads.length - freeSemPending > 0 
                    ? `${((freeSemAnswered / (freeSemLeads.length - freeSemPending)) * 100).toFixed(1)}%` 
                    : '0%',
                coordinators: Object.values(freeSemCoordinatorMap).sort((a, b) => b.assignedLeads - a.assignedLeads)
            },
            afterSeminarMetrics: {
                totalLeads: afterSemLeads.length
            },
            totalLeadsInScope: leads.length,
            verifiedPaidEnrolments: verifiedPaymentsCount
        };

    } catch (err) {
        console.error("Error gathering targeted live stats:", err);
        return null;
    }
}

/**
 * Handle conversational queries in LUMI AI Analyser
 */
exports.handleLumiAiChat = async (req, res) => {
    try {
        const { message, conversationHistory = [], currentContext = {}, selectedBusinessIds = [] } = req.body;
        if (!message) return res.status(400).json({ error: "Message is required" });

        // Gather real-time targeted database stats
        const targetedStats = await getLiveTargetedStats(message, currentContext);

        const systemInstruction = `You are **LUMI AI Executive Analyser**, the chief intelligence AI data scientist and executive strategist for IMA Campus.

### Verified Real-Time Database Metrics for Query Scope:
${targetedStats ? `
- **Business Unit:** ${targetedStats.activeBusiness.name} (ID: ${targetedStats.activeBusiness.id})
- **Active / Detected Batch:** ${targetedStats.activeBatch.name} (ID: ${targetedStats.activeBatch.id})
- **Available Batches in this Business:** ${JSON.stringify(targetedStats.availableBatches)}
- **Total Leads in Scope:** ${targetedStats.totalLeadsInScope.toLocaleString()}
- **Verified Paid Enrolments:** ${targetedStats.verifiedPaidEnrolments.toLocaleString()}

#### 🎯 Free Seminar Exact Statistics (Batch: ${targetedStats.activeBatch.name}):
- **Total Free Seminar Leads:** ${targetedStats.freeSeminarMetrics.totalLeads.toLocaleString()}
- **Assigned Leads:** ${targetedStats.freeSeminarMetrics.assignedLeads.toLocaleString()}
- **Unassigned Leads:** ${targetedStats.freeSeminarMetrics.unassignedLeads.toLocaleString()}
- **Covered (Contacted) Leads:** ${targetedStats.freeSeminarMetrics.coveredLeads.toLocaleString()}
- **Pending Contact (Uncalled / Pending):** ${targetedStats.freeSeminarMetrics.pendingLeads.toLocaleString()}
- **Answered Calls:** ${targetedStats.freeSeminarMetrics.answeredLeads.toLocaleString()}
- **No Answer Calls:** ${targetedStats.freeSeminarMetrics.noAnswerLeads.toLocaleString()}
- **Rejected Calls:** ${targetedStats.freeSeminarMetrics.rejectedLeads.toLocaleString()}
- **Overall Answer Rate:** ${targetedStats.freeSeminarMetrics.overallResponseRate}

#### 👥 Coordinator Breakdown for ${targetedStats.activeBusiness.name} (Only Coordinators Assigned to this Scope):
${JSON.stringify(targetedStats.freeSeminarMetrics.coordinators, null, 2)}
` : `
- **Context:** ${JSON.stringify(currentContext)}
`}

### Core Operational Rules:
1. **Language:** Always respond in **fluent, clean, professional Executive English**.
2. **Exact Filtered Accuracy:** 
   - When the user asks about a specific batch (e.g. August Batch, September Batch), report ONLY the exact figures and coordinators belonging to that batch and business from the verified data above!
   - Never show coordinators who have 0 assigned leads in this batch or coordinators from other streams.
3. **Structured Markdown Tables:**
   - Present coordinator performance in a clear, scannable table with columns: Coordinator Name, Role, Assigned Leads, Covered Leads, Pending Leads, Answered, No Answer, Rejected, Response Rate %.
4. **Actionable Executive Insights:**
   - Clearly state total pending leads.
   - Highlight who has the highest pending count and who has the highest answer rate.
   - Provide concrete follow-up recommendations.`;

        // Format conversation history for Gemini: Ensure first message is user and turns alternate
        const formattedHistory = [];
        for (const m of (conversationHistory || []).slice(-8)) {
            if (formattedHistory.length === 0 && m.role === 'model') {
                continue; // Skip initial assistant greeting
            }
            const role = m.role === 'user' ? 'user' : 'model';
            if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === role) {
                formattedHistory[formattedHistory.length - 1].parts[0].text += `\n\n${m.text}`;
            } else {
                formattedHistory.push({
                    role,
                    parts: [{ text: m.text }]
                });
            }
        }
        if (formattedHistory.length > 0 && formattedHistory[formattedHistory.length - 1].role === 'user') {
            formattedHistory.pop();
        }

        const chat = model.startChat({
            history: formattedHistory,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096,
            },
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            }
        });

        const result = await chat.sendMessage(message);
        const replyText = result.response.text();

        res.status(200).json({ reply: replyText });

    } catch (error) {
        console.error("LUMI AI Analyser Chat Error:", error);
        res.status(500).json({ error: "Failed to process AI analysis request", details: error.message });
    }
};

/**
 * Generate Comprehensive Future Batch Forecast Report
 */
exports.generateBatchForecast = async (req, res) => {
    try {
        const { businessId, targetBatchName } = req.body;

        const biz = await prisma.business.findUnique({
            where: { id: parseInt(businessId) || 1 },
            include: {
                batches: {
                    select: { id: true, name: true, type: true, targetIndividualGoal: true, targetGroupGoal: true }
                }
            }
        });

        if (!biz) {
            return res.status(404).json({ error: "Business not found" });
        }

        // Query leads breakdown per batch
        const batchStats = await prisma.lead.groupBy({
            by: ['batchId', 'campaignType', 'callStatus', 'enrollmentStatus'],
            where: {
                batchId: { in: biz.batches.map(b => b.id) }
            },
            _count: { id: true }
        });

        const prompt = `You are LUMI AI Executive Forecaster for IMA Campus.
Generate an Executive **Predictive Batch Forecast & Strategic Conversion Report** in professional, structured **English** for:
- Business: ${biz.name}
- Target Upcoming Intake: ${targetBatchName || 'Upcoming Intake (e.g. 2027 SEPTEMBER Intake)'}
- Historical Batches in System: ${JSON.stringify(biz.batches)}
- Historical Lead Progression Data: ${JSON.stringify(batchStats.slice(0, 40))}

Please deliver a comprehensive, complete Markdown report in English including:
1. 🎯 **Executive Summary & Projections**: Projected paid enrolments range, Confidence Score %, and revenue potential.
2. 🔮 **Funnel Stage Probability Projections**:
   - Total expected Free Seminar leads
   - Target Round 1 Answer Rate & Expected Connected Calls
   - Target Round 2 Follow-up Recovery
   - Final Paid Enrolment Target & Conversion %
3. 👥 **Coordinator Capacity & Workload Allocation**: Recommended leads per coordinator and daily call pacing.
4. ⚠️ **Dropout Risk Mitigation & Non-Enrolled Recovery**: Actionable retention tactics from Month 1 to Month 2.
5. 🚀 **7-Day Tactical Implementation Checklist**.`;

        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 4096
            }
        });
        const report = result.response.text() || "Forecast generated.";

        res.status(200).json({ report });

    } catch (error) {
        console.error("LUMI AI Forecast Error:", error);
        res.status(500).json({ error: "Failed to generate batch forecast", details: error.message });
    }
};

const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const path = require('path');
const fs = require('fs');

// Helper to check if staff/admin/lecture/guider/marker
const isStaffOrTeacher = (user) => {
    if (!user) return false;
    const role = (user.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    return [
        'SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'ASS_MANAGER', 
        'LECTURE', 'LECTURER', 'PAPER_GUIDER', 'PAPER_MARKER', 
        'COORDINATOR', 'STAFF'
    ].includes(role);
};

// Helper to calculate student Grade based on paper grading scale or standard defaults
const calculateGrade = (score, totalMarks, gradingScale) => {
    if (score === null || score === undefined) return null;
    let percentage = (totalMarks && totalMarks > 0) ? (score / totalMarks) * 100 : score;
    percentage = Math.round(percentage * 10) / 10;

    let parsedScale = gradingScale;
    if (typeof parsedScale === 'string') {
        try { parsedScale = JSON.parse(parsedScale); } catch (e) { parsedScale = null; }
    }

    if (parsedScale && Array.isArray(parsedScale) && parsedScale.length > 0) {
        for (const tier of parsedScale) {
            const min = parseFloat(tier.min !== undefined ? tier.min : 0);
            const max = parseFloat(tier.max !== undefined ? tier.max : 100);
            if (percentage >= min && percentage <= max) {
                return tier.grade;
            }
        }
    }
    // Fallback standard grading if no custom scale matches
    if (percentage >= 75) return 'A';
    if (percentage >= 65) return 'B';
    if (percentage >= 55) return 'C';
    if (percentage >= 35) return 'S';
    return 'F';
};

// Helper to safely parse teacherFeedback payload that may contain essay questionMarks
const parseTeacherFeedbackPayload = (rawFeedback) => {
    if (!rawFeedback) return { text: '', questionMarks: null };
    if (typeof rawFeedback === 'object') {
        return {
            text: rawFeedback.text || '',
            questionMarks: Array.isArray(rawFeedback.questionMarks) ? rawFeedback.questionMarks : null
        };
    }
    if (typeof rawFeedback === 'string') {
        const trimmed = rawFeedback.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object' && ('questionMarks' in parsed || 'text' in parsed)) {
                    return {
                        text: parsed.text || '',
                        questionMarks: Array.isArray(parsed.questionMarks) ? parsed.questionMarks : null
                    };
                }
            } catch (e) {}
        }
    }
    return { text: rawFeedback, questionMarks: null };
};

// 1. Get Paper Config & Details
exports.getPaperByContentId = async (req, res) => {
    try {
        const contentId = parseInt(req.params.contentId);
        if (!contentId) return res.status(400).json({ error: "Invalid content ID" });

        const userId = req.user?.userId || req.user?.id;
        const isTeacher = isStaffOrTeacher(req.user);

        const content = await prisma.content.findUnique({
            where: { id: contentId },
            include: {
                paper: {
                    include: {
                        questions: {
                            orderBy: { questionNo: 'asc' },
                            include: {
                                options: {
                                    orderBy: { optionNo: 'asc' }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!content) return res.status(404).json({ error: "Content not found" });

        let paper = content.paper;

        // If no paper object exists yet, create default one
        if (!paper) {
            const defaultPaperType = (content.contentType === 'sPaper' || content.contentType === '4') ? 'STRUCTURED' : 'MCQ';
            const totalDur = content.paperTime || 60;
            paper = await prisma.paper.create({
                data: {
                    contentId: content.id,
                    paperType: defaultPaperType,
                    timerMode: 'FLEXIBLE',
                    durationMinutes: totalDur,
                    mcqDurationMinutes: defaultPaperType === 'MCQ' ? totalDur : 30,
                    structuredDurationMinutes: defaultPaperType === 'STRUCTURED' ? totalDur : 60,
                    totalMarks: 100,
                    totalMcqMarks: 50,
                    totalStructuredMarks: 50,
                    passMarks: 40,
                    instructions: "Please read all questions carefully before submitting."
                },
                include: {
                    questions: {
                        include: { options: true }
                    }
                }
            });
        }

        // Get student's submission if student is logged in
        let userSubmission = null;
        if (userId) {
            userSubmission = await prisma.paperSubmission.findUnique({
                where: {
                    paperId_studentId: {
                        paperId: paper.id,
                        studentId: userId
                    }
                },
                include: {
                    answers: true
                }
            });
        }

        // If not a teacher and student has NOT finished/submitted, do NOT reveal `isCorrect` flags!
        const isSubmitted = userSubmission && (userSubmission.status === 'SUBMITTED' || userSubmission.status === 'GRADED' || userSubmission.status === 'PENDING_EVALUATION');
        
        let sanitizedQuestions = (paper.questions || []).map(q => {
            let images = [];
            if (q.image) {
                try {
                    const parsed = JSON.parse(q.image);
                    if (Array.isArray(parsed)) {
                        images = parsed.filter(Boolean);
                    } else if (typeof parsed === 'string' && parsed.trim()) {
                        images = [parsed.trim()];
                    } else {
                        images = [q.image];
                    }
                } catch {
                    images = [q.image];
                }
            }

            return {
                id: q.id,
                questionNo: q.questionNo,
                questionText: q.questionText,
                image: images.length > 0 ? images[0] : (q.image || null),
                images: images,
                marks: q.marks,
                options: (q.options || []).map(opt => ({
                    id: opt.id,
                    optionNo: opt.optionNo,
                    optionText: opt.optionText,
                    // Only expose isCorrect to teachers/markers or after student has submitted
                    ...(isTeacher || isSubmitted ? { isCorrect: opt.isCorrect } : {})
                }))
            };
        });

        res.json({
            content: {
                id: content.id,
                title: content.title,
                thumbnail: content.thumbnail,
                fileName: content.fileName,
                contentType: content.contentType,
                paperTime: content.paperTime,
                questionCount: content.questionCount,
                date: content.date,
                startTime: content.startTime,
                endTime: content.endTime,
                batchId: content.batchId
            },
            paper: {
                id: paper.id,
                paperType: paper.paperType, // "MCQ", "STRUCTURED", "BOTH"
                timerMode: paper.timerMode,
                scheduledStartTime: paper.scheduledStartTime,
                mcqTimerMode: paper.mcqTimerMode || paper.timerMode || 'FLEXIBLE',
                mcqScheduledStartTime: paper.mcqScheduledStartTime || paper.scheduledStartTime,
                structuredTimerMode: paper.structuredTimerMode || paper.timerMode || 'FLEXIBLE',
                structuredScheduledStartTime: paper.structuredScheduledStartTime || paper.scheduledStartTime,
                breakIntervalMinutes: paper.breakIntervalMinutes !== null && paper.breakIntervalMinutes !== undefined ? paper.breakIntervalMinutes : 15,
                structuredUploadMinutes: paper.structuredUploadMinutes !== null && paper.structuredUploadMinutes !== undefined ? paper.structuredUploadMinutes : 15,
                durationMinutes: paper.durationMinutes || content.paperTime || 60,
                mcqDurationMinutes: paper.paperType === 'MCQ' 
                    ? (paper.mcqDurationMinutes || paper.durationMinutes || content.paperTime || 60)
                    : (paper.mcqDurationMinutes || 30),
                structuredDurationMinutes: paper.paperType === 'STRUCTURED' 
                    ? (paper.structuredDurationMinutes || paper.durationMinutes || content.paperTime || 60)
                    : (paper.structuredDurationMinutes || 60),
                totalMarks: paper.totalMarks || 100,
                totalMcqMarks: paper.totalMcqMarks || 50,
                totalStructuredMarks: paper.totalStructuredMarks || 50,
                passMarks: paper.passMarks || 40,
                gradingScale: paper.gradingScale ? (typeof paper.gradingScale === 'string' ? JSON.parse(paper.gradingScale) : paper.gradingScale) : null,
                category: paper.category || 'WEEKLY',
                hasLeaderboard: paper.hasLeaderboard !== undefined ? paper.hasLeaderboard : true,
                manualParticipantCount: paper.manualParticipantCount || null,
                instructions: paper.instructions,
                mcqPaperFile: paper.mcqPaperFile,
                structuredPaperFile: paper.structuredPaperFile || content.fileName,
                questions: sanitizedQuestions
            },
            userSubmission: userSubmission ? (() => {
                const fb = parseTeacherFeedbackPayload(userSubmission.teacherFeedback);
                return {
                    id: userSubmission.id,
                    startedAt: userSubmission.startedAt,
                    submittedAt: userSubmission.submittedAt,
                    mcqSubmittedAt: userSubmission.mcqSubmittedAt,
                    structuredStartedAt: userSubmission.structuredStartedAt,
                    structuredSubmittedAt: userSubmission.structuredSubmittedAt,
                    isUploadLocked: Boolean(userSubmission.isUploadLocked),
                    status: userSubmission.status,
                    score: userSubmission.score,
                    grade: calculateGrade(userSubmission.score, paper.totalMarks, paper.gradingScale),
                    mcqScore: userSubmission.mcqScore,
                    structuredScore: userSubmission.structuredScore,
                    totalQuestions: userSubmission.totalQuestions,
                    correctAnswers: userSubmission.correctAnswers,
                    answerFile: userSubmission.answerFile,
                    answerImages: userSubmission.answerImages ? JSON.parse(userSubmission.answerImages) : [],
                    teacherFeedback: fb.text,
                    questionMarks: fb.questionMarks,
                    gradedBy: userSubmission.gradedBy,
                    gradedAt: userSubmission.gradedAt,
                    answers: userSubmission.answers
                };
            })() : null,
            serverTime: new Date()
        });

    } catch (err) {
        console.error("getPaperByContentId Error:", err);
        res.status(500).json({ error: "Failed to load paper details" });
    }
};

// 2. Save Paper Configuration (Admin/Lecturer)
exports.savePaperConfig = async (req, res) => {
    try {
        const { 
            contentId, 
            paperType, 
            timerMode, 
            scheduledStartTime, 
            mcqTimerMode,
            mcqScheduledStartTime,
            structuredTimerMode,
            structuredScheduledStartTime,
            breakIntervalMinutes,
            structuredUploadMinutes,
            durationMinutes, 
            mcqDurationMinutes, 
            structuredDurationMinutes, 
            totalMarks, 
            totalMcqMarks, 
            totalStructuredMarks, 
            passMarks, 
            instructions,
            gradingScale,
            category,
            hasLeaderboard,
            questionCount,
            manualParticipantCount,
            mcqPaperFile,
            structuredPaperFile
        } = req.body;
        
        if (!contentId) return res.status(400).json({ error: "contentId is required" });

        const parsedContentId = parseInt(contentId);
        const parsedDuration = parseInt(durationMinutes || 60);
        const parsedStartTime = scheduledStartTime ? new Date(scheduledStartTime) : null;
        const resolvedMcqTimer = mcqTimerMode || timerMode || 'FLEXIBLE';
        const resolvedStructTimer = structuredTimerMode || timerMode || 'FLEXIBLE';
        const parsedMcqStartTime = mcqScheduledStartTime ? new Date(mcqScheduledStartTime) : (resolvedMcqTimer === 'SCHEDULED' ? parsedStartTime : null);
        const parsedStructStartTime = structuredScheduledStartTime ? new Date(structuredScheduledStartTime) : (resolvedStructTimer === 'SCHEDULED' ? parsedStartTime : null);
        const validPaperType = ['MCQ', 'STRUCTURED', 'BOTH'].includes(paperType) ? paperType : 'MCQ';

        let finalDuration = parsedDuration;
        let finalMcqDuration = mcqDurationMinutes !== undefined ? parseInt(mcqDurationMinutes) : (validPaperType === 'MCQ' ? parsedDuration : 30);
        let finalStructDuration = structuredDurationMinutes !== undefined ? parseInt(structuredDurationMinutes) : (validPaperType === 'STRUCTURED' ? parsedDuration : 60);

        if (validPaperType === 'MCQ') {
            finalDuration = finalMcqDuration;
        } else if (validPaperType === 'STRUCTURED') {
            finalDuration = finalStructDuration;
        } else if (validPaperType === 'BOTH') {
            finalDuration = finalMcqDuration + finalStructDuration;
        }

        const parsedCategory = category && ['WEEKLY', 'MONTHLY'].includes(String(category).toUpperCase()) ? String(category).toUpperCase() : 'WEEKLY';
        const parsedHasLeaderboard = hasLeaderboard !== undefined ? (hasLeaderboard === true || hasLeaderboard === 'true' || hasLeaderboard === 1 || hasLeaderboard === '1') : true;
        const parsedParticipantCount = manualParticipantCount !== undefined && manualParticipantCount !== null && manualParticipantCount !== '' ? parseInt(manualParticipantCount) : null;

        let parsedGradingScale = undefined;
        if (gradingScale !== undefined && gradingScale !== null && gradingScale !== '') {
            parsedGradingScale = typeof gradingScale === 'string' ? gradingScale : JSON.stringify(gradingScale);
        }

        const updateData = {
            paperType: validPaperType,
            category: parsedCategory,
            hasLeaderboard: parsedHasLeaderboard,
            manualParticipantCount: parsedParticipantCount,
            timerMode: timerMode || (resolvedMcqTimer === 'SCHEDULED' || resolvedStructTimer === 'SCHEDULED' ? 'SCHEDULED' : 'FLEXIBLE'),
            scheduledStartTime: parsedStartTime || parsedMcqStartTime || parsedStructStartTime,
            mcqTimerMode: resolvedMcqTimer,
            mcqScheduledStartTime: parsedMcqStartTime,
            structuredTimerMode: resolvedStructTimer,
            structuredScheduledStartTime: parsedStructStartTime,
            breakIntervalMinutes: breakIntervalMinutes !== undefined && breakIntervalMinutes !== '' ? parseInt(breakIntervalMinutes) : 15,
            structuredUploadMinutes: structuredUploadMinutes !== undefined && structuredUploadMinutes !== '' ? parseInt(structuredUploadMinutes) : 15,
            durationMinutes: finalDuration,
            mcqDurationMinutes: finalMcqDuration,
            structuredDurationMinutes: finalStructDuration,
            totalMarks: totalMarks ? parseFloat(totalMarks) : 100,
            totalMcqMarks: totalMcqMarks ? parseFloat(totalMcqMarks) : 50,
            totalStructuredMarks: totalStructuredMarks ? parseFloat(totalStructuredMarks) : 50,
            passMarks: passMarks ? parseFloat(passMarks) : 40,
            instructions: instructions || null,
            ...(parsedGradingScale !== undefined ? { gradingScale: parsedGradingScale } : {}),
            ...(mcqPaperFile !== undefined ? { mcqPaperFile } : {}),
            ...(structuredPaperFile !== undefined ? { structuredPaperFile } : {})
        };

        const paper = await prisma.paper.upsert({
            where: { contentId: parsedContentId },
            update: updateData,
            create: {
                contentId: parsedContentId,
                ...updateData
            }
        });

        // Also sync durationMinutes and questionCount back to Content
        const contentUpdateData = { paperTime: parsedDuration };
        if (questionCount !== undefined && questionCount !== null && questionCount !== '') {
            contentUpdateData.questionCount = parseInt(questionCount) || null;
        }
        await prisma.content.update({
            where: { id: parsedContentId },
            data: contentUpdateData
        });

        res.json({ message: "Paper settings saved successfully", paper });
    } catch (err) {
        console.error("savePaperConfig Error:", err);
        res.status(500).json({ error: "Failed to save paper configuration" });
    }
};

// Upload Master Question Paper PDF
exports.uploadMasterSheet = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        const { contentId, paperType } = req.body;
        const filename = req.file.filename;

        if (contentId) {
            const parsedId = parseInt(contentId);
            // Update content fileName so students can access master file
            await prisma.content.update({
                where: { id: parsedId },
                data: { fileName: filename }
            });

            // Update paper structuredPaperFile
            await prisma.paper.upsert({
                where: { contentId: parsedId },
                create: {
                    contentId: parsedId,
                    structuredPaperFile: filename,
                    paperType: paperType || 'STRUCTURED'
                },
                update: {
                    structuredPaperFile: filename
                }
            });
        }

        res.json({
            message: "Master question paper uploaded successfully",
            filename,
            fileUrl: `/storage/documents/${filename}`
        });
    } catch (err) {
        console.error("uploadMasterSheet Error:", err);
        res.status(500).json({ error: "Failed to upload master question paper" });
    }
};

// 3. Save Questions & Answers (Bulk save/edit for MCQ)
exports.saveQuestions = async (req, res) => {
    try {
        const { paperId, questions } = req.body;
        if (!paperId) return res.status(400).json({ error: "paperId is required" });
        if (!Array.isArray(questions)) return res.status(400).json({ error: "questions must be an array" });

        const parsedPaperId = parseInt(paperId);

        // Run in transaction to replace questions
        await prisma.$transaction(async (tx) => {
            // Delete old questions (Cascade will delete options)
            await tx.paperQuestion.deleteMany({
                where: { paperId: parsedPaperId }
            });

            // Insert new questions and options
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                let storedImage = null;
                if (Array.isArray(q.images) && q.images.length > 0) {
                    const validImages = q.images.filter(img => typeof img === 'string' && img.trim().length > 0);
                    if (validImages.length === 1) {
                        storedImage = validImages[0];
                    } else if (validImages.length > 1) {
                        storedImage = JSON.stringify(validImages);
                    }
                } else if (typeof q.image === 'string' && q.image.trim().length > 0) {
                    storedImage = q.image.trim();
                }

                const createdQuestion = await tx.paperQuestion.create({
                    data: {
                        paperId: parsedPaperId,
                        questionNo: q.questionNo || (i + 1),
                        questionText: q.questionText || `Question ${i + 1}`,
                        image: storedImage,
                        marks: q.marks ? parseFloat(q.marks) : 1.0
                    }
                });

                if (Array.isArray(q.options) && q.options.length > 0) {
                    const optionsData = q.options.map((opt, optIdx) => ({
                        questionId: createdQuestion.id,
                        optionNo: opt.optionNo || (optIdx + 1),
                        optionText: opt.optionText || '',
                        isCorrect: Boolean(opt.isCorrect)
                    }));

                    await tx.paperOption.createMany({
                        data: optionsData
                    });
                }
            }

            // Sync questionCount to Content
            const paper = await tx.paper.findUnique({
                where: { id: parsedPaperId },
                select: { contentId: true }
            });
            if (paper) {
                await tx.content.update({
                    where: { id: paper.contentId },
                    data: { questionCount: questions.length }
                });
            }
        });

        res.json({ message: "Questions saved successfully", count: questions.length });
    } catch (err) {
        console.error("saveQuestions Error:", err);
        res.status(500).json({ error: "Failed to save questions" });
    }
};

// 4. Start Paper (Student starts exam)
exports.startPaper = async (req, res) => {
    try {
        const paperId = parseInt(req.params.paperId);
        const studentId = req.user?.userId || req.user?.id;
        const section = (req.body?.section || req.query?.section || '').toUpperCase();

        if (!paperId || !studentId) return res.status(400).json({ error: "Missing paperId or studentId" });

        const paper = await prisma.paper.findUnique({
            where: { id: paperId }
        });

        if (!paper) return res.status(404).json({ error: "Paper not found" });

        // Check if student already started
        let submission = await prisma.paperSubmission.findUnique({
            where: {
                paperId_studentId: {
                    paperId,
                    studentId
                }
            }
        });

        const now = new Date();

        const isStructuredPaper = paper.paperType === 'STRUCTURED' || section === 'STRUCTURED';

        if (!submission) {
            submission = await prisma.paperSubmission.create({
                data: {
                    paperId,
                    studentId,
                    startedAt: now,
                    ...(isStructuredPaper ? { structuredStartedAt: now } : {}),
                    status: "IN_PROGRESS"
                }
            });
        } else {
            // If starting structured section and timestamp not recorded yet
            if (isStructuredPaper && !submission.structuredStartedAt) {
                submission = await prisma.paperSubmission.update({
                    where: { id: submission.id },
                    data: {
                        structuredStartedAt: now
                    }
                });
            }
        }

        res.json({
            message: "Paper session started",
            submission,
            serverTime: new Date()
        });
    } catch (err) {
        console.error("startPaper Error:", err);
        res.status(500).json({ error: "Failed to start paper" });
    }
};

// Helper to extract uploaded files (single answerFile and/or multiple answerImages)
const extractUploadedFiles = (req) => {
    let answerFile = null;
    let answerImages = [];

    // Check req.files
    if (req.files) {
        if (Array.isArray(req.files)) {
            req.files.forEach(f => {
                const ext = path.extname(f.originalname || f.filename).toLowerCase();
                if (ext === '.pdf') {
                    if (!answerFile) answerFile = f.filename;
                } else {
                    answerImages.push(f.filename);
                }
            });
        } else {
            if (req.files['answerFile'] && req.files['answerFile'].length > 0) {
                answerFile = req.files['answerFile'][0].filename;
            }
            if (req.files['answerImages'] && req.files['answerImages'].length > 0) {
                answerImages = req.files['answerImages'].map(f => f.filename);
            }
        }
    } else if (req.file) {
        const ext = path.extname(req.file.originalname || req.file.filename).toLowerCase();
        if (ext === '.pdf') {
            answerFile = req.file.filename;
        } else {
            answerImages.push(req.file.filename);
        }
    }

    // Fallbacks from body if sent as strings or URLs
    if (!answerFile && req.body.answerFile) {
        answerFile = req.body.answerFile;
    }
    if (answerImages.length === 0 && req.body.answerImages) {
        try {
            const parsed = typeof req.body.answerImages === 'string' ? JSON.parse(req.body.answerImages) : req.body.answerImages;
            if (Array.isArray(parsed)) answerImages = parsed;
        } catch(e) {
            if (typeof req.body.answerImages === 'string') answerImages = [req.body.answerImages];
        }
    }

    return { answerFile, answerImages };
};

// 5. Submit Paper (MCQ, STRUCTURED, or BOTH)
exports.submitPaper = async (req, res) => {
    try {
        const paperId = parseInt(req.params.paperId);
        const studentId = req.user?.userId || req.user?.id;
        const requestedSection = (req.body.section || req.query.section || '').toUpperCase();

        if (!paperId || !studentId) return res.status(400).json({ error: "Missing paperId or studentId" });

        const paper = await prisma.paper.findUnique({
            where: { id: paperId },
            include: {
                questions: {
                    include: { options: true }
                }
            }
        });

        if (!paper) return res.status(404).json({ error: "Paper not found" });

        let submission = await prisma.paperSubmission.findUnique({
            where: {
                paperId_studentId: {
                    paperId,
                    studentId
                }
            }
        });

        if (!submission) {
            submission = await prisma.paperSubmission.create({
                data: {
                    paperId,
                    studentId,
                    startedAt: new Date(),
                    status: "IN_PROGRESS"
                }
            });
        }

        const { answerFile, answerImages } = extractUploadedFiles(req);

        // Helper to evaluate MCQ questions
        const gradeMcqSection = (answersArray) => {
            let totalCorrect = 0;
            let totalQuestions = paper.questions.length;
            let totalPossibleMarks = 0;
            let totalEarnedMarks = 0;
            const answersToCreate = [];

            (paper.questions || []).forEach(q => {
                const qMarks = q.marks || 1;
                totalPossibleMarks += qMarks;
                const studentAns = Array.isArray(answersArray) ? answersArray.find(a => a.questionId === q.id) : null;
                const correctOption = q.options.find(opt => opt.isCorrect);

                const isCorrect = Boolean(studentAns && correctOption && studentAns.selectedOptionId === correctOption.id);

                if (isCorrect) {
                    totalCorrect++;
                    totalEarnedMarks += qMarks;
                }

                answersToCreate.push({
                    questionId: q.id,
                    selectedOptionId: studentAns?.selectedOptionId || null,
                    isCorrect
                });
            });

            const totalMaxMarks = paper.paperType === 'BOTH' ? (paper.totalMcqMarks || 50) : (paper.totalMarks || 100);
            const score = totalPossibleMarks > 0 ? parseFloat(((totalEarnedMarks / totalPossibleMarks) * totalMaxMarks).toFixed(2)) : 0;

            return { score, totalCorrect, totalQuestions, answersToCreate };
        };

        const validateStructuredUploadWindow = () => {
            const writingMins = paper.paperType === 'STRUCTURED'
                ? (paper.structuredDurationMinutes || paper.durationMinutes || 60)
                : (paper.structuredDurationMinutes || 60);
            const uploadMins = paper.structuredUploadMinutes || 15;
            const totalAllowedMins = writingMins + uploadMins;

            let startRefMs = null;
            const isScheduled = paper.structuredTimerMode === 'SCHEDULED' || paper.timerMode === 'SCHEDULED';
            const scheduledStart = paper.structuredScheduledStartTime || paper.scheduledStartTime;

            if (isScheduled && scheduledStart) {
                startRefMs = new Date(scheduledStart).getTime();
            } else if (submission.structuredStartedAt) {
                startRefMs = new Date(submission.structuredStartedAt).getTime();
            } else if (submission.startedAt) {
                startRefMs = new Date(submission.startedAt).getTime();
            }

            if (!startRefMs) return { isExpired: false };

            const deadlineMs = startRefMs + (totalAllowedMins * 60 * 1000);
            const gracePeriodMs = 90 * 1000; // 90 seconds grace for network upload latency
            const nowMs = Date.now();

            if (nowMs > (deadlineMs + gracePeriodMs)) {
                return { isExpired: true, deadline: new Date(deadlineMs) };
            }
            return { isExpired: false, deadline: new Date(deadlineMs) };
        };

        // Parse answers if passed as JSON string
        let rawAnswers = req.body.answers;
        if (typeof rawAnswers === 'string') {
            try { rawAnswers = JSON.parse(rawAnswers); } catch(e) { rawAnswers = []; }
        }

        // =====================================
        // CASE 1: MCQ ONLY
        // =====================================
        if (paper.paperType === 'MCQ') {
            const mcqResult = gradeMcqSection(rawAnswers);

            await prisma.$transaction(async (tx) => {
                await tx.paperSubmissionAnswer.deleteMany({
                    where: { submissionId: submission.id }
                });

                for (const sa of mcqResult.answersToCreate) {
                    await tx.paperSubmissionAnswer.create({
                        data: {
                            submissionId: submission.id,
                            questionId: sa.questionId,
                            selectedOptionId: sa.selectedOptionId,
                            isCorrect: sa.isCorrect
                        }
                    });
                }

                submission = await tx.paperSubmission.update({
                    where: { id: submission.id },
                    data: {
                        status: "SUBMITTED",
                        submittedAt: new Date(),
                        mcqSubmittedAt: new Date(),
                        score: mcqResult.score,
                        mcqScore: mcqResult.score,
                        totalQuestions: mcqResult.totalQuestions,
                        correctAnswers: mcqResult.totalCorrect
                    },
                    include: { answers: true }
                });
            });

            return res.json({
                message: "MCQ Paper submitted successfully!",
                score: submission.score,
                mcqScore: submission.mcqScore,
                correctAnswers: submission.correctAnswers,
                totalQuestions: submission.totalQuestions,
                passMarks: paper.passMarks,
                isPassed: submission.score >= (paper.passMarks || 40),
                submission
            });
        }

        // =====================================
        // CASE 2: STRUCTURED ONLY
        // =====================================
        else if (paper.paperType === 'STRUCTURED') {
            // Validate upload window
            const uploadWindowCheck = validateStructuredUploadWindow();
            if (uploadWindowCheck.isExpired) {
                await prisma.paperSubmission.update({
                    where: { id: submission.id },
                    data: { isUploadLocked: true }
                });
                return res.status(403).json({
                    error: "The upload time window has expired. Submissions are now closed.",
                    isUploadLocked: true
                });
            }

            if (!answerFile && answerImages.length === 0 && !submission.answerFile && !submission.answerImages) {
                return res.status(400).json({ error: "Please upload your answer sheet (PDF or clear photos)." });
            }

            const existingImages = submission.answerImages ? JSON.parse(submission.answerImages) : [];
            const mergedImages = [...existingImages, ...answerImages];

            submission = await prisma.paperSubmission.update({
                where: { id: submission.id },
                data: {
                    status: "PENDING_EVALUATION",
                    submittedAt: new Date(),
                    structuredSubmittedAt: new Date(),
                    answerFile: answerFile || submission.answerFile,
                    answerImages: mergedImages.length > 0 ? JSON.stringify(mergedImages) : submission.answerImages
                }
            });

            return res.json({
                message: "Structured Paper submitted successfully! Awaiting marker evaluation.",
                status: "PENDING_EVALUATION",
                submission
            });
        }

        // =====================================
        // CASE 3: BOTH (MCQ + STRUCTURED)
        // =====================================
        else if (paper.paperType === 'BOTH') {
            // Subcase 3A: Student submitting Part 1 (MCQ only)
            if (requestedSection === 'MCQ' || requestedSection === 'PART1') {
                const mcqResult = gradeMcqSection(rawAnswers);

                await prisma.$transaction(async (tx) => {
                    if (mcqResult.answersToCreate.length > 0) {
                        await tx.paperSubmissionAnswer.deleteMany({
                            where: { submissionId: submission.id }
                        });

                        for (const sa of mcqResult.answersToCreate) {
                            await tx.paperSubmissionAnswer.create({
                                data: {
                                    submissionId: submission.id,
                                    questionId: sa.questionId,
                                    selectedOptionId: sa.selectedOptionId,
                                    isCorrect: sa.isCorrect
                                }
                            });
                        }
                    }

                    submission = await tx.paperSubmission.update({
                        where: { id: submission.id },
                        data: {
                            mcqSubmittedAt: new Date(),
                            score: mcqResult.score,
                            mcqScore: mcqResult.score,
                            totalQuestions: mcqResult.totalQuestions,
                            correctAnswers: mcqResult.totalCorrect
                        },
                        include: { answers: true }
                    });
                });

                return res.json({
                    message: "Part 1 (MCQ) completed! Your MCQ score has been recorded.",
                    section: 'MCQ',
                    score: submission.score,
                    mcqScore: submission.mcqScore,
                    correctAnswers: submission.correctAnswers,
                    totalQuestions: submission.totalQuestions,
                    submission
                });
            }

            // Subcase 3B: Student submitting Part 2 (STRUCTURED) or Final combined submission
            const uploadWindowCheck = validateStructuredUploadWindow();
            if (uploadWindowCheck.isExpired) {
                await prisma.paperSubmission.update({
                    where: { id: submission.id },
                    data: { isUploadLocked: true }
                });
                return res.status(403).json({
                    error: "The upload time window has expired. Submissions are now closed.",
                    isUploadLocked: true
                });
            }

            let mcqResult = null;
            if (Array.isArray(rawAnswers) && rawAnswers.length > 0) {
                mcqResult = gradeMcqSection(rawAnswers);
            }

            const existingImages = submission.answerImages ? JSON.parse(submission.answerImages) : [];
            const mergedImages = [...existingImages, ...answerImages];

            await prisma.$transaction(async (tx) => {
                if (mcqResult && mcqResult.answersToCreate.length > 0) {
                    await tx.paperSubmissionAnswer.deleteMany({
                        where: { submissionId: submission.id }
                    });

                    for (const sa of mcqResult.answersToCreate) {
                        await tx.paperSubmissionAnswer.create({
                            data: {
                                submissionId: submission.id,
                                questionId: sa.questionId,
                                selectedOptionId: sa.selectedOptionId,
                                isCorrect: sa.isCorrect
                            }
                        });
                    }
                }

                const finalMcqScore = mcqResult ? mcqResult.score : (submission.mcqScore || 0);

                submission = await tx.paperSubmission.update({
                    where: { id: submission.id },
                    data: {
                        status: "PENDING_EVALUATION",
                        submittedAt: new Date(),
                        structuredSubmittedAt: new Date(),
                        score: finalMcqScore, // Reflects MCQ score until structured section is marked
                        mcqScore: finalMcqScore,
                        totalQuestions: mcqResult ? mcqResult.totalQuestions : submission.totalQuestions,
                        correctAnswers: mcqResult ? mcqResult.totalCorrect : submission.correctAnswers,
                        answerFile: answerFile || submission.answerFile,
                        answerImages: mergedImages.length > 0 ? JSON.stringify(mergedImages) : submission.answerImages
                    },
                    include: { answers: true }
                });
            });

            return res.json({
                message: "Ranking Test submitted successfully! MCQ marks calculated, Structured section is pending marker evaluation.",
                score: submission.score,
                mcqScore: submission.mcqScore,
                structuredScore: null,
                correctAnswers: submission.correctAnswers,
                totalQuestions: submission.totalQuestions,
                status: "PENDING_EVALUATION",
                passMarks: paper.passMarks,
                submission
            });
        }

    } catch (err) {
        console.error("submitPaper Error:", err);
        res.status(500).json({ error: "Failed to submit paper" });
    }
};

// 6. Get All Submissions for a Paper (Admin / Lecturer / Guider / Marker)
exports.getPaperSubmissions = async (req, res) => {
    try {
        const paperId = parseInt(req.params.paperId);
        if (!paperId) return res.status(400).json({ error: "paperId is required" });

        const submissions = await prisma.paperSubmission.findMany({
            where: { paperId },
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        image: true,
                        city: true
                    }
                },
                paper: {
                    select: {
                        totalMarks: true,
                        passMarks: true,
                        gradingScale: true
                    }
                },
                answers: true
            },
            orderBy: { submittedAt: 'desc' }
        });

        const formatted = submissions.map(sub => {
            const fb = parseTeacherFeedbackPayload(sub.teacherFeedback);
            return {
                ...sub,
                teacherFeedback: fb.text,
                questionMarks: fb.questionMarks,
                grade: calculateGrade(sub.score, sub.paper?.totalMarks, sub.paper?.gradingScale),
                answerImages: sub.answerImages ? JSON.parse(sub.answerImages) : []
            };
        });

        res.json({ submissions: formatted });
    } catch (err) {
        console.error("getPaperSubmissions Error:", err);
        res.status(500).json({ error: "Failed to get submissions" });
    }
};

// 7. Grade Structured Paper Submission (Lecturer / Paper Marker)
exports.gradeStructuredSubmission = async (req, res) => {
    try {
        const submissionId = parseInt(req.params.submissionId);
        const { score, teacherFeedback, questionMarks } = req.body;

        if (!submissionId) return res.status(400).json({ error: "submissionId is required" });

        const existingSub = await prisma.paperSubmission.findUnique({
            where: { id: submissionId },
            include: { paper: true }
        });

        if (!existingSub) return res.status(404).json({ error: "Submission not found" });

        const parsedStructuredScore = score !== undefined ? parseFloat(score) : 0;
        let finalScore = parsedStructuredScore;

        if (existingSub.paper?.paperType === 'BOTH') {
            finalScore = parseFloat(((existingSub.mcqScore || 0) + parsedStructuredScore).toFixed(2));
        }

        const markerId = req.user?.userId || req.user?.id;

        // Bundle questionMarks and teacherFeedback into a structured JSON string
        let feedbackToStore = teacherFeedback || null;
        if (questionMarks !== undefined && questionMarks !== null) {
            feedbackToStore = JSON.stringify({
                text: teacherFeedback || '',
                questionMarks: questionMarks
            });
        }

        const updated = await prisma.paperSubmission.update({
            where: { id: submissionId },
            data: {
                structuredScore: parsedStructuredScore,
                score: finalScore,
                teacherFeedback: feedbackToStore,
                status: "GRADED",
                gradedBy: markerId ? parseInt(markerId) : null,
                gradedAt: new Date()
            }
        });

        const fb = parseTeacherFeedbackPayload(updated.teacherFeedback);

        res.json({ 
            message: "Submission graded successfully", 
            submission: {
                ...updated,
                teacherFeedback: fb.text,
                questionMarks: fb.questionMarks,
                answerImages: updated.answerImages ? JSON.parse(updated.answerImages) : []
            } 
        });
    } catch (err) {
        console.error("gradeStructuredSubmission Error:", err);
        res.status(500).json({ error: "Failed to grade submission" });
    }
};

// 8. Get Paper Leaderboard
exports.getPaperLeaderboard = async (req, res) => {
    try {
        const paperId = parseInt(req.params.paperId);
        if (!paperId) return res.status(400).json({ error: "paperId is required" });

        const paper = await prisma.paper.findUnique({
            where: { id: paperId },
            include: { 
                content: {
                    select: { id: true, title: true }
                }
            }
        });
        if (!paper) return res.status(404).json({ error: "Paper not found" });

        const submissions = await prisma.paperSubmission.findMany({
            where: {
                paperId,
                status: { in: ['SUBMITTED', 'GRADED', 'PENDING_EVALUATION'] }
            },
            include: {
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        image: true,
                        city: true,
                        district: true
                    }
                }
            },
            orderBy: [
                { score: 'desc' },
                { submittedAt: 'asc' }
            ]
        });

        let currentRank = 0;
        let lastScore = null;
        const rankedList = submissions.map((sub, index) => {
            if (sub.score !== lastScore) {
                currentRank = index + 1;
                lastScore = sub.score;
            }
            let durationSeconds = null;
            if (sub.startedAt && sub.submittedAt) {
                durationSeconds = Math.max(0, Math.floor((new Date(sub.submittedAt).getTime() - new Date(sub.startedAt).getTime()) / 1000));
            }

            return {
                id: sub.id,
                rank: currentRank,
                submissionId: sub.id,
                student: {
                    id: sub.student.id,
                    name: `${sub.student.firstName || ''} ${sub.student.lastName || ''}`.trim() || 'Student',
                    firstName: sub.student.firstName,
                    lastName: sub.student.lastName,
                    image: sub.student.image,
                    city: sub.student.city || sub.student.district || 'IMA Campus'
                },
                score: sub.score || 0,
                grade: calculateGrade(sub.score, paper.totalMarks, paper.gradingScale),
                mcqScore: sub.mcqScore || 0,
                structuredScore: sub.structuredScore || 0,
                status: sub.status,
                durationSeconds,
                durationMinutes: durationSeconds ? Math.round(durationSeconds / 60) : 0,
                submittedAt: sub.submittedAt
            };
        });

        const totalParticipants = paper.manualParticipantCount && paper.manualParticipantCount > 0 
            ? paper.manualParticipantCount 
            : rankedList.length;

        // Podium: Top 3 (1st, 2nd, 3rd)
        const podium = {
            first: rankedList[0] || null,
            second: rankedList[1] || null,
            third: rankedList[2] || null
        };

        // Calling student's standing / rank
        const callingUserId = req.user?.userId || req.user?.id;
        let myStanding = null;
        if (callingUserId) {
            const foundIdx = rankedList.findIndex(r => String(r.student?.id) === String(callingUserId));
            if (foundIdx !== -1) {
                const me = rankedList[foundIdx];
                myStanding = {
                    ...me,
                    totalParticipants,
                    isPodium: me.rank <= 3,
                    topScore: rankedList[0]?.score || 0,
                    scoreGap: rankedList[0] ? parseFloat(((rankedList[0].score || 0) - (me.score || 0)).toFixed(2)) : 0
                };
            }
        }

        res.json({
            paper: {
                id: paper.id,
                title: paper.content?.title || 'Ranking Test',
                paperType: paper.paperType,
                category: paper.category || 'WEEKLY',
                hasLeaderboard: paper.hasLeaderboard ?? true,
                totalMarks: paper.totalMarks || 100,
                passMarks: paper.passMarks || 40,
                gradingScale: paper.gradingScale ? (() => {
                    try {
                        return typeof paper.gradingScale === 'string' ? JSON.parse(paper.gradingScale) : paper.gradingScale;
                    } catch (e) {
                        return null;
                    }
                })() : null,
                manualParticipantCount: paper.manualParticipantCount || null
            },
            totalParticipants,
            manualParticipantCount: paper.manualParticipantCount || null,
            actualSubmissionsCount: rankedList.length,
            podium,
            myStanding,
            leaderboard: rankedList
        });
    } catch (err) {
        console.error("getPaperLeaderboard Error:", err);
        res.status(500).json({ error: "Failed to load leaderboard" });
    }
};

// 9. Get Student Paper Progress (Weekly vs Monthly Analytics & Charts)
exports.getStudentPaperProgress = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        if (!studentId) return res.status(401).json({ error: "Unauthorized" });

        const submissions = await prisma.paperSubmission.findMany({
            where: { 
                studentId,
                status: { in: ['SUBMITTED', 'GRADED', 'PENDING_EVALUATION'] }
            },
            include: {
                paper: {
                    include: {
                        content: {
                            select: {
                                id: true,
                                title: true,
                                batchId: true,
                                courseId: true,
                                date: true
                            }
                        }
                    }
                }
            },
            orderBy: { submittedAt: 'desc' }
        });

        // Fetch course and batch names for all submissions
        const courseIds = [...new Set(submissions.map(s => s.paper?.content?.courseId).filter(Boolean))];
        const batchIds = [...new Set(submissions.map(s => s.paper?.content?.batchId).filter(Boolean))];

        const courses = courseIds.length > 0 ? await prisma.course.findMany({
            where: { id: { in: courseIds } },
            select: { id: true, name: true, code: true }
        }) : [];

        const batches = batchIds.length > 0 ? await prisma.batch.findMany({
            where: { id: { in: batchIds } },
            select: { id: true, name: true }
        }) : [];

        const courseMap = new Map(courses.map(c => [c.id, c.name]));
        const batchMap = new Map(batches.map(b => [b.id, b.name]));

        // Compute rank and total participants for each submission
        const enrichedSubmissions = await Promise.all(submissions.map(async (s) => {
            const higherScoreCount = await prisma.paperSubmission.count({
                where: {
                    paperId: s.paperId,
                    status: { in: ['SUBMITTED', 'GRADED', 'PENDING_EVALUATION'] },
                    score: { gt: s.score || 0 }
                }
            });
            const actualTotalInPaper = await prisma.paperSubmission.count({
                where: {
                    paperId: s.paperId,
                    status: { in: ['SUBMITTED', 'GRADED', 'PENDING_EVALUATION'] }
                }
            });

            const rank = higherScoreCount + 1;
            const officialParticipants = s.paper?.manualParticipantCount && s.paper.manualParticipantCount > 0 
                ? s.paper.manualParticipantCount 
                : actualTotalInPaper;

            const totalMarks = s.paper?.totalMarks || 100;
            const percentage = totalMarks > 0 ? parseFloat((((s.score || 0) / totalMarks) * 100).toFixed(1)) : 0;
            const category = s.paper?.category || 'WEEKLY';
            const paperType = s.paper?.paperType || 'MCQ';

            const fb = parseTeacherFeedbackPayload(s.teacherFeedback);
            const cId = s.paper?.content?.courseId || null;
            const bId = s.paper?.content?.batchId || null;
            const courseName = cId ? courseMap.get(cId) : null;
            const batchName = bId ? batchMap.get(bId) : null;
            const classLabel = courseName || batchName || 'General Paper Class';

            return {
                id: s.id,
                paperId: s.paperId,
                contentId: s.paper?.content?.id,
                testTitle: s.paper?.content?.title || 'Ranking Test',
                category,
                paperType,
                courseId: cId,
                courseName,
                batchId: bId,
                batchName,
                classLabel,
                score: s.score || 0,
                mcqScore: s.mcqScore || 0,
                structuredScore: s.structuredScore || 0,
                totalMarks,
                passMarks: s.paper?.passMarks || 40,
                percentage,
                rank,
                grade: calculateGrade(s.score, totalMarks, s.paper?.gradingScale),
                totalParticipants: officialParticipants,
                isPassed: (s.score || 0) >= (s.paper?.passMarks || 40),
                status: s.status,
                submittedAt: s.submittedAt,
                teacherFeedback: fb.text,
                questionMarks: fb.questionMarks
            };
        }));

        // Helper to compute summary for a group
        const computeGroupSummary = (list) => {
            const total = list.length;
            if (total === 0) {
                return { totalTaken: 0, averageScore: 0, highestScore: 0, averagePercentage: 0, passCount: 0, passRate: 0, history: [] };
            }
            const totalScore = list.reduce((sum, item) => sum + item.score, 0);
            const totalPerc = list.reduce((sum, item) => sum + item.percentage, 0);
            const highestScore = Math.max(...list.map(i => i.score));
            const passCount = list.filter(i => i.isPassed).length;

            return {
                totalTaken: total,
                averageScore: parseFloat((totalScore / total).toFixed(1)),
                highestScore,
                averagePercentage: parseFloat((totalPerc / total).toFixed(1)),
                passCount,
                passRate: Math.round((passCount / total) * 100),
                history: list
            };
        };

        // Also fetch all enrolled courses for this student to build complete class filter list
        const validPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [1, 4] } },
            select: { subjects: true }
        });
        const rawSubjectIds = [];
        validPayments.forEach(p => {
            if (p.subjects) {
                try {
                    const raw = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
                    if (Array.isArray(raw)) {
                        raw.forEach(id => {
                            const num = parseInt(id, 10);
                            if (!isNaN(num) && num > 0) rawSubjectIds.push(num);
                        });
                    }
                } catch(e) {}
            }
        });
        const enrolledCourses = rawSubjectIds.length > 0 ? await prisma.course.findMany({
            where: { id: { in: rawSubjectIds } },
            select: { id: true, name: true, code: true }
        }) : [];

        // Build distinct class options (combining tested courses + enrolled courses)
        const classOptionsMap = new Map();
        courses.forEach(c => classOptionsMap.set(c.id, { id: c.id, name: c.name, code: c.code, type: 'course' }));
        enrolledCourses.forEach(c => {
            if (!classOptionsMap.has(c.id)) {
                classOptionsMap.set(c.id, { id: c.id, name: c.name, code: c.code, type: 'course' });
            }
        });
        // Also add any distinct batch names if not covered by course
        batches.forEach(b => {
            if (!classOptionsMap.has(`batch_${b.id}`)) {
                classOptionsMap.set(`batch_${b.id}`, { id: `batch_${b.id}`, batchId: b.id, name: b.name, type: 'batch' });
            }
        });

        // Compute latest leaderboard for student's most recent paper
        let latestLeaderboard = null;
        if (enrichedSubmissions.length > 0) {
            const latestPaperId = enrichedSubmissions[0].paperId;
            const paperInfo = await prisma.paper.findUnique({
                where: { id: latestPaperId },
                include: { content: { select: { title: true, courseId: true, batchId: true } } }
            });
            const subList = await prisma.paperSubmission.findMany({
                where: { paperId: latestPaperId, status: { in: ['SUBMITTED', 'GRADED', 'PENDING_EVALUATION'] } },
                include: { student: { select: { id: true, firstName: true, lastName: true, image: true, city: true, district: true } } },
                orderBy: [{ score: 'desc' }, { submittedAt: 'asc' }],
                take: 15
            });
            let cRank = 0;
            let lScore = null;
            latestLeaderboard = {
                paperId: latestPaperId,
                testTitle: paperInfo?.content?.title || enrichedSubmissions[0].testTitle,
                totalMarks: paperInfo?.totalMarks || 100,
                ranks: subList.map((sb, i) => {
                    if (sb.score !== lScore) {
                        cRank = i + 1;
                        lScore = sb.score;
                    }
                    return {
                        rank: cRank,
                        studentId: sb.student?.id,
                        name: `${sb.student?.firstName || ''} ${sb.student?.lastName || ''}`.trim() || 'Student',
                        firstName: sb.student?.firstName,
                        image: sb.student?.image,
                        city: sb.student?.city || sb.student?.district || 'IMA Campus',
                        score: sb.score || 0,
                        grade: calculateGrade(sb.score, paperInfo?.totalMarks || 100, paperInfo?.gradingScale)
                    };
                })
            };
        }

        const weeklyList = enrichedSubmissions.filter(s => s.category === 'WEEKLY');
        const monthlyList = enrichedSubmissions.filter(s => s.category === 'MONTHLY');

        const mcqList = enrichedSubmissions.filter(s => s.paperType === 'MCQ');
        const structList = enrichedSubmissions.filter(s => s.paperType === 'STRUCTURED');
        const bothList = enrichedSubmissions.filter(s => s.paperType === 'BOTH');

        // Chronological order for chart plotting (oldest to newest)
        const chartData = [...enrichedSubmissions].sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt)).map(item => ({
            id: item.id,
            paperId: item.paperId,
            testTitle: item.testTitle,
            category: item.category,
            paperType: item.paperType,
            courseId: item.courseId,
            batchId: item.batchId,
            classLabel: item.classLabel,
            score: item.score,
            percentage: item.percentage,
            rank: item.rank,
            totalParticipants: item.totalParticipants,
            submittedAt: item.submittedAt
        }));

        res.json({
            overall: computeGroupSummary(enrichedSubmissions),
            weekly: computeGroupSummary(weeklyList),
            monthly: computeGroupSummary(monthlyList),
            byType: {
                mcq: computeGroupSummary(mcqList),
                structured: computeGroupSummary(structList),
                both: computeGroupSummary(bothList)
            },
            classes: Array.from(classOptionsMap.values()),
            chartData,
            recentTests: enrichedSubmissions,
            latestLeaderboard
        });
    } catch (err) {
        console.error("getStudentPaperProgress Error:", err);
        res.status(500).json({ error: "Failed to load student progress" });
    }
};

// 9.1 Check Student Paper Class Enrollment & Available Paper Classes for Guider Chat
exports.getStudentPaperClassAccess = async (req, res) => {
    try {
        const studentId = req.user?.userId || req.user?.id;
        if (!studentId) return res.status(401).json({ error: "Unauthorized" });

        // 1. Check valid payments for groups with classType === 2 (Paper Class)
        const paperPayments = await prisma.payment.findMany({
            where: {
                studentId: parseInt(studentId),
                status: { in: [0, 1, 4] },
                group: { classType: 2 }
            },
            include: {
                business: { select: { id: true, name: true, logo: true } },
                batch: { select: { id: true, name: true } },
                group: { select: { id: true, name: true, classType: true } }
            }
        });

        // 2. Also check enrolled courses with 'paper' in the title or course group classType === 2
        const allValidPayments = await prisma.payment.findMany({
            where: { studentId: parseInt(studentId), status: { in: [1, 4] } },
            select: { subjects: true }
        });
        const rawSubjectIds = [];
        allValidPayments.forEach(p => {
            if (p.subjects) {
                try {
                    const raw = typeof p.subjects === 'string' ? JSON.parse(p.subjects) : p.subjects;
                    if (Array.isArray(raw)) {
                        raw.forEach(id => {
                            const num = parseInt(id, 10);
                            if (!isNaN(num) && num > 0) rawSubjectIds.push(num);
                        });
                    }
                } catch(e) {}
            }
        });

        const enrolledCourses = rawSubjectIds.length > 0 ? await prisma.course.findMany({
            where: { id: { in: rawSubjectIds } },
            include: {
                group: {
                    include: {
                        batch: {
                            include: { business: true }
                        }
                    }
                }
            }
        }) : [];

        const paperCourses = enrolledCourses.filter(c => 
            c.group?.classType === 2 || 
            (c.name && c.name.toLowerCase().includes('paper')) ||
            (c.group?.name && c.group?.name.toLowerCase().includes('paper')) ||
            (c.group?.batch?.name && c.group?.batch?.name.toLowerCase().includes('paper'))
        );

        // 3. Also check if student has any paper submissions
        const submissionCount = await prisma.paperSubmission.count({
            where: { studentId: parseInt(studentId) }
        });

        const isEnrolledInPaperClass = paperPayments.length > 0 || paperCourses.length > 0 || submissionCount > 0;

        // Build unique list of paper classes available to this student
        const paperClassesMap = new Map();
        paperCourses.forEach(pc => {
            paperClassesMap.set(pc.id, {
                id: pc.id,
                name: pc.name,
                code: pc.code,
                businessId: pc.group?.batch?.business?.id || pc.group?.batch?.businessId || 1,
                businessName: pc.group?.batch?.business?.name || "IMA Campus",
                batchName: pc.group?.batch?.name || "",
                groupName: pc.group?.name || ""
            });
        });

        paperPayments.forEach(pp => {
            if (pp.group?.id && !paperClassesMap.has(pp.groupId)) {
                paperClassesMap.set(pp.groupId, {
                    id: pp.groupId,
                    name: `${pp.batch?.name || ''} - ${pp.group?.name || 'Paper Class'}`.trim(),
                    businessId: pp.businessId || pp.business?.id || 1,
                    businessName: pp.business?.name || "IMA Campus",
                    batchName: pp.batch?.name || "",
                    groupName: pp.group?.name || ""
                });
            }
        });

        // Fallback: if student has submitted papers but payment classType wasn't marked 2
        if (paperClassesMap.size === 0 && isEnrolledInPaperClass) {
            paperClassesMap.set(0, {
                id: 0,
                name: "General Paper Class / Tests",
                businessId: 1,
                businessName: "IMA Campus",
                batchName: "Paper Program",
                groupName: "All Batches"
            });
        }

        res.json({
            success: true,
            isEnrolledInPaperClass,
            paperClasses: Array.from(paperClassesMap.values()),
            totalSubmissions: submissionCount
        });
    } catch (err) {
        console.error("getStudentPaperClassAccess Error:", err);
        res.status(500).json({ error: "Failed to verify paper class enrollment" });
    }
};

// 10. Get Submissions Queue for Paper Markers
exports.getMarkerSubmissionsList = async (req, res) => {
    try {
        const user = req.user;
        const isSysAdmin = ['SYSTEM_ADMIN', 'DIRECTOR'].includes((user?.role || '').toUpperCase().replace(/[\s_-]+/g, '_'));
        const businessType = user?.businessType;
        const userBizList = businessType ? String(businessType).split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];

        const whereClause = {
            paper: {
                paperType: { in: ['STRUCTURED', 'BOTH'] }
            }
        };

        const { status, paperId } = req.query;
        if (status) {
            whereClause.status = status;
        }
        if (paperId) {
            whereClause.paperId = parseInt(paperId);
        }

        const submissions = await prisma.paperSubmission.findMany({
            where: whereClause,
            include: {
                paper: {
                    include: {
                        content: {
                            select: {
                                id: true,
                                title: true,
                                fileName: true,
                                batchId: true
                            }
                        }
                    }
                },
                student: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                        image: true,
                        city: true
                    }
                }
            },
            orderBy: { submittedAt: 'desc' },
            take: 200
        });

        let filteredSubmissions = submissions;
        if (!isSysAdmin && userBizList.length > 0) {
            const batchIds = [...new Set(submissions.map(s => s.paper?.content?.batchId).filter(Boolean))];
            const batches = await prisma.batch.findMany({
                where: { id: { in: batchIds } },
                include: { business: true }
            });
            const batchBizMap = {};
            batches.forEach(b => {
                batchBizMap[b.id] = (b.business?.name || '').toLowerCase().trim();
            });

            filteredSubmissions = submissions.filter(s => {
                const bId = s.paper?.content?.batchId;
                const bBiz = batchBizMap[bId];
                if (!bBiz) return true;
                return userBizList.some(ub => bBiz.includes(ub) || ub.includes(bBiz));
            });
        }

        const formatted = filteredSubmissions.map(s => {
            const fb = parseTeacherFeedbackPayload(s.teacherFeedback);
            return {
                ...s,
                teacherFeedback: fb.text,
                questionMarks: fb.questionMarks,
                answerImages: s.answerImages ? JSON.parse(s.answerImages) : []
            };
        });

        res.json({ submissions: formatted });
    } catch (err) {
        console.error("getMarkerSubmissionsList Error:", err);
        res.status(500).json({ error: "Failed to load marker submissions" });
    }
};

// 12. Upload Question Images / Figures (Supports multiple images for MCQ questions)
exports.uploadQuestionImages = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: "No image files uploaded" });
        }

        const uploadedFiles = req.files.map(f => ({
            filename: f.filename,
            url: `/storage/documents/${f.filename}`,
            size: f.size,
            mimetype: f.mimetype
        }));

        res.json({
            message: "Question images uploaded successfully",
            files: uploadedFiles,
            filenames: uploadedFiles.map(f => f.filename)
        });
    } catch (err) {
        console.error("uploadQuestionImages Error:", err);
        res.status(500).json({ error: "Failed to upload question images" });
    }
};

// ================= AI MCQ EXTRACTION FROM PDF (STREAMING SSE) =================

// In-memory cache for pre-parsed PDF sessions (TTL: 20 minutes)
const mcqPdfSessionCache = new Map();

// Periodic cleanup of expired sessions
setInterval(() => {
    const now = Date.now();
    for (const [key, session] of mcqPdfSessionCache.entries()) {
        if (now - session.createdAt > 20 * 60 * 1000) {
            mcqPdfSessionCache.delete(key);
        }
    }
}, 5 * 60 * 1000);

// Helper: Render single PDF page to JPEG buffer using pdftoppm
function renderPdfPageToImage(pdfPath, pageNum) {
    if (!pdfPath || !fs.existsSync(pdfPath)) return null;
    const { execSync } = require('child_process');
    const tmpPrefix = path.join('/tmp', `mcq_page_${Date.now()}_${pageNum}_${Math.random().toString(36).substring(2, 6)}`);
    try {
        execSync(`pdftoppm -jpeg -r 140 -f ${pageNum} -l ${pageNum} "${pdfPath}" "${tmpPrefix}"`, { timeout: 15000 });
        const dir = '/tmp';
        const basename = path.basename(tmpPrefix);
        const matches = fs.readdirSync(dir).filter(f => f.startsWith(basename) && f.endsWith('.jpg'));
        if (matches.length > 0) {
            const foundPath = path.join(dir, matches[0]);
            const buffer = fs.readFileSync(foundPath);
            try { fs.unlinkSync(foundPath); } catch (e) {}
            return buffer;
        }
    } catch (e) {
        console.error(`[pdftoppm] Error rendering page ${pageNum}:`, e.message);
    }
    return null;
}

// Helper: Call Gemini models with key fallback and retry (Supports text and scanned page images)
async function callGeminiForQuestions(promptText, customKey, imageBuffer = null) {
    const candidateKeys = [];
    if (customKey && typeof customKey === 'string' && customKey.trim()) {
        candidateKeys.push(customKey.trim());
    }

    try {
        const s1 = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY' } });
        const s2 = await prisma.appSetting.findUnique({ where: { key: 'GEMINI_API_KEY_2' } });
        if (s1?.value && !candidateKeys.includes(s1.value)) candidateKeys.push(s1.value);
        if (s2?.value && !candidateKeys.includes(s2.value)) candidateKeys.push(s2.value);
    } catch (e) {
        console.error("[AI MCQ] Error reading Gemini keys from AppSetting:", e.message);
    }

    if (process.env.GEMINI_API_KEY && !candidateKeys.includes(process.env.GEMINI_API_KEY)) {
        candidateKeys.push(process.env.GEMINI_API_KEY);
    }

    if (candidateKeys.length === 0) {
        throw new Error("No Gemini API key configured. Please enter a valid Gemini API key in the settings box.");
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.5-pro'];

    let lastError = null;
    let quotaDepletedCount = 0;

    for (const key of candidateKeys) {
        for (const modelName of modelsToTry) {
            try {
                const genAI = new GoogleGenerativeAI(key);
                const model = genAI.getGenerativeModel({
                    model: modelName,
                    generationConfig: {
                        temperature: 0.15,
                        responseMimeType: "application/json"
                    }
                });

                let contentPayload;
                if (imageBuffer && Buffer.isBuffer(imageBuffer)) {
                    contentPayload = [
                        { text: promptText },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: imageBuffer.toString('base64')
                            }
                        }
                    ];
                } else {
                    contentPayload = promptText;
                }

                const result = await model.generateContent(contentPayload);
                const text = result?.response?.text ? result.response.text() : '';
                if (text && text.trim()) {
                    return text;
                }
            } catch (err) {
                lastError = err;
                const msg = String(err.message || '');
                if (msg.includes('402') || msg.includes('depleted') || msg.includes('RESOURCE_EXHAUSTED')) {
                    quotaDepletedCount++;
                }
                // Try next model or next candidate key
                continue;
            }
        }
    }

    if (quotaDepletedCount > 0) {
        throw new Error("Gemini API key credits are depleted (402). Please enter an active Google AI Studio key in the API Key settings.");
    }

    const errMsg = lastError?.message || "Failed to communicate with Gemini AI. Please check your API key.";
    if (errMsg.includes('leaked') || errMsg.includes('PERMISSION_DENIED')) {
        throw new Error("Gemini API key is blocked or invalid (403). Please enter a fresh Google AI Studio key.");
    }

    throw new Error(errMsg);
}

// Helper: Parse AI raw response safely into MCQ questions array
function parseQuestionsJson(rawText) {
    if (!rawText) return [];
    let clean = String(rawText).trim();
    if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```/, '').replace(/```$/, '').trim();
    }

    try {
        const parsed = JSON.parse(clean);
        const arr = Array.isArray(parsed) ? parsed : (parsed.questions || parsed.data || Object.values(parsed)[0] || []);
        if (!Array.isArray(arr)) return [];

        return arr.map((item, idx) => {
            const rawOptions = Array.isArray(item.options) ? item.options : [];
            const options = rawOptions.map((opt, oIdx) => {
                if (typeof opt === 'string') {
                    return { optionNo: oIdx + 1, optionText: opt.trim(), isCorrect: oIdx === 0 };
                }
                return {
                    optionNo: opt.optionNo || (oIdx + 1),
                    optionText: String(opt.optionText || opt.text || opt.title || '').trim(),
                    isCorrect: Boolean(opt.isCorrect || opt.correct || opt.is_correct)
                };
            }).filter(o => o.optionText.length > 0);

            // Default fallback options if none parsed
            const finalOptions = options.length >= 2 ? options : [
                { optionNo: 1, optionText: 'Option 1', isCorrect: true },
                { optionNo: 2, optionText: 'Option 2', isCorrect: false },
                { optionNo: 3, optionText: 'Option 3', isCorrect: false },
                { optionNo: 4, optionText: 'Option 4', isCorrect: false }
            ];

            // Ensure at least one option is marked correct
            const hasCorrect = finalOptions.some(o => o.isCorrect);
            if (!hasCorrect && finalOptions.length > 0) {
                finalOptions[0].isCorrect = true;
            }

            return {
                questionNo: parseInt(item.questionNo) || (idx + 1),
                questionText: String(item.questionText || item.question || item.title || '').trim(),
                image: '',
                images: [],
                marks: parseInt(item.marks) || 1,
                options: finalOptions
            };
        }).filter(q => q.questionText.length > 0);
    } catch (e) {
        console.error("[AI MCQ] Error parsing JSON questions from Gemini:", e.message);
        return [];
    }
}

// 13.1 Pre-upload & Parse PDF for MCQ Extraction (Rock-solid step 1)
exports.aiUploadMcqPdf = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No PDF file uploaded. Please select a valid PDF." });
        }

        const filePath = req.file.path;
        const { PDFParse } = require('pdf-parse');
        const buffer = fs.readFileSync(filePath);
        const parser = new PDFParse(new Uint8Array(buffer));
        await parser.load();

        const textResult = await parser.getText();
        const rawPages = textResult.pages || [];
        const totalPages = rawPages.length > 0 ? rawPages.length : 1;

        const pages = [];
        let hasAnyDigitalText = false;
        for (let i = 0; i < totalPages; i++) {
            const rawText = rawPages[i]?.text ? rawPages[i].text.trim() : "";
            if (rawText.length >= 40) hasAnyDigitalText = true;
            pages.push({
                pageNumber: i + 1,
                text: rawText,
                isScanned: rawText.length < 40
            });
        }

        const fileId = 'mcq_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        mcqPdfSessionCache.set(fileId, {
            fileId,
            filePath, // Retain on disk for pdftoppm image extraction
            fileName: req.file.originalname,
            totalPages,
            pages,
            hasAnyDigitalText,
            createdAt: Date.now()
        });

        res.json({
            success: true,
            fileId,
            fileName: req.file.originalname,
            totalPages,
            hasScannedPages: !hasAnyDigitalText,
            message: `PDF loaded successfully with ${totalPages} page(s). ${!hasAnyDigitalText ? '(Scanned document detected - Gemini Vision will read images)' : ''}`
        });
    } catch (err) {
        console.error("aiUploadMcqPdf Error:", err);
        res.status(500).json({ error: err.message || "Failed to parse PDF" });
    }
};

// 13.2 AI MCQ Extraction Stream (SSE - Step 2)
exports.aiExtractMcqStream = async (req, res) => {
    // SSE Headers for real-time streaming
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    if (res.flushHeaders) res.flushHeaders();

    let isAborted = false;
    req.on('close', () => {
        isAborted = true;
    });

    // Heartbeat ping every 3 seconds to keep proxy/Cloudflare alive
    const heartbeat = setInterval(() => {
        if (isAborted) return;
        try {
            res.write(': keep-alive\n\n');
            if (res.flush) res.flush();
        } catch (e) {}
    }, 3000);

    const sendEvent = (event, data) => {
        if (isAborted) return;
        try {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            if (res.flush) res.flush();
        } catch (e) {}
    };

    let sessionPdfPath = null;
    let tempDirectFilePath = null;
    try {
        const fileId = req.body?.fileId || req.query?.fileId;
        const customApiKey = req.body?.customApiKey || req.query?.customApiKey || null;

        let totalPages = 0;
        let fileName = "Exam Paper";
        let pagesToProcess = [];

        if (fileId && mcqPdfSessionCache.has(fileId)) {
            const session = mcqPdfSessionCache.get(fileId);
            totalPages = session.totalPages;
            fileName = session.fileName;
            pagesToProcess = session.pages;
            sessionPdfPath = session.filePath;
        } else if (req.file) {
            tempDirectFilePath = req.file.path;
            const { PDFParse } = require('pdf-parse');
            const buffer = fs.readFileSync(tempDirectFilePath);
            const parser = new PDFParse(new Uint8Array(buffer));
            await parser.load();
            const textResult = await parser.getText();
            const rawPages = textResult.pages || [];
            totalPages = rawPages.length > 0 ? rawPages.length : 1;
            fileName = req.file.originalname;
            for (let i = 0; i < totalPages; i++) {
                const txt = rawPages[i]?.text ? rawPages[i].text.trim() : "";
                pagesToProcess.push({
                    pageNumber: i + 1,
                    text: txt,
                    isScanned: txt.length < 40
                });
            }
            sessionPdfPath = tempDirectFilePath;
        } else {
            sendEvent('fatal_error', { message: "No active PDF session or file found. Please upload the PDF again." });
            clearInterval(heartbeat);
            return res.end();
        }

        sendEvent('init', {
            totalPages,
            fileName,
            message: `Starting real-time extraction across ${totalPages} page(s)...`
        });

        let runningQuestionIndex = 0;
        let allQuestions = [];

        for (let i = 0; i < pagesToProcess.length; i++) {
            if (isAborted) break;

            const pageItem = pagesToProcess[i];
            const pageNum = pageItem.pageNumber;
            const pageText = pageItem.text || "";
            const isScanned = pageItem.isScanned || pageText.length < 40;

            let imageBuffer = null;
            if (isScanned && sessionPdfPath) {
                sendEvent('page_start', {
                    pageNumber: pageNum,
                    totalPages,
                    message: `Page ${pageNum} is a scanned page. Rendering & analyzing image with Gemini Vision...`
                });
                imageBuffer = renderPdfPageToImage(sessionPdfPath, pageNum);
            } else {
                sendEvent('page_start', {
                    pageNumber: pageNum,
                    totalPages,
                    message: `Reading & extracting Page ${pageNum} of ${totalPages}...`
                });
            }

            if (!imageBuffer && (!pageText || pageText.length < 15)) {
                sendEvent('page_skip', {
                    pageNumber: pageNum,
                    totalPages,
                    message: `Page ${pageNum} has no readable text or image content. Skipped.`
                });
                continue;
            }

            const prompt = `
You are an expert exam paper reader and teacher assistant in Sri Lanka.
Analyze this exam paper page (Page ${pageNum} of ${totalPages}) carefully.
${imageBuffer ? 'This is an image of a scanned exam paper.' : `Page text:\n"""\n${pageText}\n"""`}

The language of the paper can be Sinhala, English, or Tamil.
Instructions:
1. Extract ALL Multiple Choice Questions (MCQ) visible on this page.
2. For each question, extract:
   - "questionNo": number (e.g. 1, 2, 3...)
   - "questionText": question statement in the original language. Preserve accurate scientific terms, formulas, and math symbols.
   - "options": list of choices:
     [
       { "optionNo": 1, "optionText": "Choice 1 text", "isCorrect": true },
       { "optionNo": 2, "optionText": "Choice 2 text", "isCorrect": false },
       { "optionNo": 3, "optionText": "Choice 3 text", "isCorrect": false },
       { "optionNo": 4, "optionText": "Choice 4 text", "isCorrect": false }
     ]
3. Mark "isCorrect": true if an answer choice has an underline, mark, circle, or standard key. Otherwise default "isCorrect": true to option 1 for teacher review.
4. Output STRICT JSON array format:
[
  {
    "questionNo": 1,
    "questionText": "Question statement...",
    "options": [...]
  }
]
If this page does NOT contain MCQ questions (e.g. structured essay questions, instructions cover, or advertisements), return an empty array [].
`;

            try {
                const aiRawResponse = await callGeminiForQuestions(prompt, customApiKey, imageBuffer);
                const pageQuestions = parseQuestionsJson(aiRawResponse);

                if (pageQuestions.length > 0) {
                    const indexedQuestions = pageQuestions.map(q => {
                        runningQuestionIndex++;
                        return {
                            ...q,
                            questionNo: runningQuestionIndex,
                            extractedFromPage: pageNum
                        };
                    });

                    allQuestions = allQuestions.concat(indexedQuestions);

                    sendEvent('questions_chunk', {
                        pageNumber: pageNum,
                        totalPages,
                        questions: indexedQuestions,
                        totalSoFar: allQuestions.length,
                        message: `Page ${pageNum}: Extracted ${indexedQuestions.length} question(s)!`
                    });
                } else {
                    sendEvent('page_no_questions', {
                        pageNumber: pageNum,
                        totalPages,
                        message: `Page ${pageNum} contained no MCQ questions.`
                    });
                }
            } catch (pageErr) {
                console.error(`[AI MCQ] Page ${pageNum} error:`, pageErr.message);
                const msg = pageErr.message || "Failed to process page with AI";
                sendEvent('page_error', {
                    pageNumber: pageNum,
                    totalPages,
                    error: msg
                });

                // If fatal quota error, notify and stop immediately
                if (msg.includes('402') || msg.includes('depleted') || msg.includes('blocked') || msg.includes('leaked')) {
                    sendEvent('key_error', {
                        message: msg
                    });
                    break;
                }
            }
        }

        if (!isAborted) {
            sendEvent('complete', {
                totalPages,
                totalExtractedQuestions: allQuestions.length,
                message: `Extraction complete! Total ${allQuestions.length} MCQ question(s) extracted.`
            });
        }
    } catch (err) {
        console.error("aiExtractMcqStream Error:", err);
        sendEvent('fatal_error', {
            message: err.message || "Failed to extract questions from PDF"
        });
    } finally {
        clearInterval(heartbeat);
        if (tempDirectFilePath && fs.existsSync(tempDirectFilePath)) {
            try { fs.unlinkSync(tempDirectFilePath); } catch (e) {}
        }
        res.end();
    }
};

// 13.3 Test Gemini API Key
exports.testGeminiKey = async (req, res) => {
    try {
        const { apiKey } = req.body;
        if (!apiKey || !apiKey.trim()) {
            return res.status(400).json({ valid: false, error: "Please enter an API key to test." });
        }

        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey.trim());
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const result = await model.generateContent("Hello, reply with 'OK'");
        const text = result?.response?.text ? result.response.text().trim() : '';

        res.json({
            valid: true,
            message: "Gemini API Key is valid and active!",
            model: "gemini-2.5-flash",
            reply: text
        });
    } catch (err) {
        console.error("testGeminiKey Error:", err.message);
        let userMsg = err.message;
        if (userMsg.includes('402') || userMsg.includes('depleted')) {
            userMsg = "This API key has 0 prepayment credits (402). Please add credits or generate a new key from Google AI Studio.";
        } else if (userMsg.includes('leaked') || userMsg.includes('PERMISSION_DENIED')) {
            userMsg = "This API key was reported leaked or has invalid permissions (403).";
        }
        res.status(400).json({ valid: false, error: userMsg });
    }
};

// 14. Save Gemini API Key to System AppSetting
exports.saveGeminiApiKey = async (req, res) => {
    try {
        const { apiKey } = req.body;
        if (!apiKey || !apiKey.trim()) {
            return res.status(400).json({ error: "API key is required" });
        }
        await prisma.appSetting.upsert({
            where: { key: 'GEMINI_API_KEY' },
            update: { value: apiKey.trim() },
            create: { key: 'GEMINI_API_KEY', value: apiKey.trim() }
        });
        res.json({ message: "Gemini API key saved to system settings successfully!" });
    } catch (err) {
        console.error("saveGeminiApiKey Error:", err);
        res.status(500).json({ error: "Failed to save API key" });
    }
};



const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const pdfParse = require('pdf-parse'); 
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

// ==========================================
// 1. SETTINGS: CrmSettings
// ==========================================
exports.saveCrmSettings = async (req, res) => {
    try {
        const { businessId, campaignType, metaApiKey, waId, waNumId, geminiKeys, botMode, openSemActive, batchId, welcomeMessageText, btnAllowText, btnStopText } = req.body;
        
        // Ensure businessId is an integer and campaignType exists
        if (!businessId || !campaignType) {
            return res.status(400).json({ error: "Missing businessId or campaignType" });
        }

        const existing = await prisma.crmSettings.findFirst({
            where: { 
                businessId: parseInt(businessId), 
                campaignType: campaignType 
            }
        });

        // Safe conversion of data
        const settingsData = {
            metaApiKey: metaApiKey || null,
            waId: waId || null,
            waNumId: waNumId || null,
            geminiKeys: geminiKeys || [], 
            botMode: botMode || 'OFF',
            openSemActive: openSemActive || false,
            batchId: batchId ? String(batchId) : null,
            welcomeMessageText: welcomeMessageText || null,
            btnAllowText: btnAllowText || null,
            btnStopText: btnStopText || null
        };

        if (existing) {
            const updated = await prisma.crmSettings.update({
                where: { id: existing.id },
                data: settingsData
            });
            return res.status(200).json({ message: "Settings updated", data: updated });
        } else {
            const created = await prisma.crmSettings.create({
                data: { 
                    businessId: parseInt(businessId), 
                    campaignType: campaignType, 
                    ...settingsData 
                }
            });
            return res.status(201).json({ message: "Settings saved", data: created });
        }
    } catch (error) {
        console.error("Save settings error:", error);
        res.status(500).json({ error: "Failed to save settings", details: error.message });
    }
};

exports.getCrmSettings = async (req, res) => {
    try {
        const { businessId, campaignType } = req.params;
        const settings = await prisma.crmSettings.findFirst({
            where: { 
                businessId: parseInt(businessId), 
                campaignType: campaignType 
            }
        });
        res.status(200).json(settings || {});
    } catch (error) {
        console.error("Get settings error:", error);
        res.status(500).json({ error: "Failed to get settings" });
    }
};

// ==========================================
// 2. KNOWLEDGE BASE: KnowledgeBase (AI Training)
// ==========================================
exports.uploadKnowledge = async (req, res) => {
    try {
        const { businessId, campaignType } = req.body;
        const file = req.file;

        if (!file) return res.status(400).json({ error: "PDF file is required" });

        const dataBuffer = fs.readFileSync(file.path);
        const data = await pdfParse(dataBuffer);

        const newKB = await prisma.knowledgeBase.create({
            data: {
                businessId: parseInt(businessId),
                campaignType: campaignType || 'FREE_SEMINAR',
                fileName: file.originalname,
                fileUrl: `/storage/documents/${file.filename}`,
                content: data.text
            }
        });

        res.status(201).json({ message: "Knowledge base updated successfully", data: newKB });
    } catch (error) {
        console.error("Upload KB error:", error);
        res.status(500).json({ error: "Failed to upload knowledge base" });
    }
};

// ==========================================
// 3. AUTO REPLIES: Message Sequence
// ==========================================
exports.addAutoReply = async (req, res) => {
    try {
        console.log("--- DEBUG: ADD AUTO REPLY ---");
        console.log("Body:", req.body);
        console.log("File:", req.file);

        const { businessId, campaignType, stepOrder, message } = req.body;
        const file = req.file;

        let attachmentUrl = null;
        let attachmentType = null;
        
        if (file) {
            attachmentUrl = `/storage/documents/${file.filename}`;
            
            // 🔥 UPDATE: Video / Audio එක අඳුරගන්න කොටස 🔥
            const originalNameLower = file.originalname.toLowerCase();
            if (file.mimetype.includes('image')) {
                attachmentType = 'Image';
            } else if (file.mimetype.includes('video')) {
                attachmentType = 'Video';
            } else if (file.mimetype.includes('audio') || originalNameLower.endsWith('.mp3') || originalNameLower.endsWith('.ogg') || originalNameLower.endsWith('.m4a') || originalNameLower.endsWith('.wav') || originalNameLower.endsWith('.webm') || originalNameLower.endsWith('.aac')) {
                attachmentType = 'Audio';
                
                // 🔥 Convert to OGG Opus for 100% universal WhatsApp Voice Note support (iOS & Android)
                const inputPath = path.join(process.cwd(), 'storage/documents', file.filename);
                const outputFilename = `VN_CONVERTED_${Date.now()}.ogg`;
                const outputPath = path.join(process.cwd(), 'storage/documents', outputFilename);
                
                try {
                    await new Promise((resolve, reject) => {
                        ffmpeg(inputPath)
                            .audioCodec('libopus')
                            .audioBitrate('32k')
                            .audioChannels(1)
                            .audioFrequency(48000)
                            .outputOptions([
                                '-application voip',
                                '-avoid_negative_ts make_zero',
                                '-map_metadata -1'
                            ])
                            .toFormat('ogg')
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err))
                            .save(outputPath);
                    });
                    attachmentUrl = `/storage/documents/${outputFilename}`;
                } catch (err) {
                    console.error("Audio conversion failed in CRM upload:", err);
                }
            } else {
                attachmentType = 'Document';
            }
        }

        const newTemplate = await prisma.autoReply.create({
            data: {
                businessId: parseInt(businessId),
                campaignType: campaignType || 'FREE_SEMINAR',
                stepOrder: parseInt(stepOrder) || 1,
                message: message || '',
                attachment: attachmentUrl,
                attachmentType: attachmentType
            }
        });

        res.status(201).json({ message: "Auto reply added successfully", data: newTemplate });
    } catch (error) {
        console.error("Add reply error:", error);
        res.status(500).json({ error: "Failed to add auto reply", details: error.message });
    }
};

exports.getAutoReplies = async (req, res) => {
    try {
        const { businessId, campaignType } = req.query;
        let whereClause = {};
        if (businessId) whereClause.businessId = parseInt(businessId);
        if (campaignType) whereClause.campaignType = campaignType;

        const replies = await prisma.autoReply.findMany({
            where: whereClause,
            orderBy: { stepOrder: 'asc' } 
        });

        res.status(200).json(replies);
    } catch (error) {
        console.error("Get replies error:", error);
        res.status(500).json({ error: "Failed to get auto replies" });
    }
};

exports.deleteAutoReply = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.autoReply.delete({
            where: { id: parseInt(id) }
        });
        res.status(200).json({ message: "Auto reply deleted" });
    } catch (error) {
        console.error("Delete reply error:", error);
        res.status(500).json({ error: "Failed to delete auto reply" });
    }
};

// ==========================================
// 4. CAMPAIGN ARCHIVE
// ==========================================

exports.updateAutoReply = async (req, res) => {
    console.log("UPDATE AUTO REPLY HIT", req.params.id);
    try {
        const { id } = req.params;
        const { stepOrder, message } = req.body;
        const file = req.file;

        let dataToUpdate = {};
        if (stepOrder) dataToUpdate.stepOrder = parseInt(stepOrder);
        if (message) dataToUpdate.message = message;

        if (file) {
            let attachmentUrl = `/storage/documents/${file.filename}`;
            let attachmentType = null;
            const originalNameLower = file.originalname.toLowerCase();
            
            if (file.mimetype.includes('image')) {
                attachmentType = 'Image';
            } else if (file.mimetype.includes('video')) {
                attachmentType = 'Video';
            } else if (file.mimetype.includes('audio') || originalNameLower.endsWith('.mp3') || originalNameLower.endsWith('.ogg') || originalNameLower.endsWith('.m4a') || originalNameLower.endsWith('.wav') || originalNameLower.endsWith('.webm') || originalNameLower.endsWith('.aac')) {
                attachmentType = 'Audio';
                
                // 🔥 Convert to OGG Opus for 100% universal WhatsApp Voice Note support (iOS & Android)
                const inputPath = path.join(process.cwd(), 'storage/documents', file.filename);
                const outputFilename = `VN_CONVERTED_${Date.now()}.ogg`;
                const outputPath = path.join(process.cwd(), 'storage/documents', outputFilename);
                
                try {
                    await new Promise((resolve, reject) => {
                        ffmpeg(inputPath)
                            .audioCodec('libopus')
                            .audioBitrate('32k')
                            .audioChannels(1)
                            .audioFrequency(48000)
                            .outputOptions([
                                '-application voip',
                                '-avoid_negative_ts make_zero',
                                '-map_metadata -1'
                            ])
                            .toFormat('ogg')
                            .on('end', () => resolve())
                            .on('error', (err) => reject(err))
                            .save(outputPath);
                    });
                    attachmentUrl = `/storage/documents/${outputFilename}`;
                } catch (err) {
                    console.error("Audio conversion failed in CRM update:", err);
                }
            } else {
                attachmentType = 'Document';
            }
            dataToUpdate.attachment = attachmentUrl;
            dataToUpdate.attachmentType = attachmentType;
        }

        const updatedTemplate = await prisma.autoReply.update({
            where: { id: parseInt(id) },
            data: dataToUpdate
        });

        res.status(200).json({ message: "Auto reply updated successfully", data: updatedTemplate });
    } catch (error) {
        console.error("Update reply error:", error);
        res.status(500).json({ error: "Failed to update auto reply", details: error.message });
    }
};

// ==========================================
exports.archiveCampaign = async (req, res) => {
    try {
        const { businessId, campaignType } = req.body;

        try {
            await prisma.lead.updateMany({
                where: { businessId: parseInt(businessId), campaignType, status: { not: 'ARCHIVED' } },
                data: { status: 'ARCHIVED' }
            });
        } catch (e) {
            console.log("No lead table found to archive. Skipping lead update.");
        }

        res.status(200).json({ message: "Campaign archived successfully." });
    } catch (error) {
        console.error("Archive error:", error);
        res.status(500).json({ error: "Failed to archive campaign" });
    }
};

// ==========================================
// 5. META OTP: WebhookLog
// ==========================================
exports.getMetaOtps = async (req, res) => {
    try {
        const otps = await prisma.webhookLog.findMany({
            where: { status: 'OTP' },
            orderBy: { createdAt: 'desc' },
            take: 20
        });
        res.status(200).json(otps);
    } catch (error) {
        console.error("Get Meta OTPs error:", error);
        res.status(500).json({ error: "Failed to get Meta OTPs" });
    }
};
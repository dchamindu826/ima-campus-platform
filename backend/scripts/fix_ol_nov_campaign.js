const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    console.log("=== STARTING OL NOVEMBER CAMPAIGN DATA CLEANUP ===");

    const paidLeadMappings = [
        { id: 83072, targetBatchId: 41, name: "Lithum Pansilu" },
        { id: 115853, targetBatchId: 41, name: "Menaka Premaratne" },
        { id: 59287, targetBatchId: 20, name: "VISHWA sathsara" },
        { id: 82801, targetBatchId: 20, name: "Yohan Lakshitha" },
        { id: 82812, targetBatchId: 20, name: "Aneesha Sandamini" },
        { id: 82829, targetBatchId: 20, name: "TSM Fernando" },
        { id: 82830, targetBatchId: 20, name: "Amitha sara Thero" },
        { id: 82839, targetBatchId: 20, name: "Thusharika Karunarathne" },
        { id: 82841, targetBatchId: 20, name: "Desindu Senith" },
        { id: 82860, targetBatchId: 20, name: "Bishak Nicholas" },
        { id: 82861, targetBatchId: 45, name: "Rajitha kalhara" },
        { id: 82867, targetBatchId: 20, name: "Brian Abeywickrama" },
        { id: 82869, targetBatchId: 20, name: "Sachini Samudika" },
        { id: 82899, targetBatchId: 20, name: "Yomal Vidusara" },
        { id: 82900, targetBatchId: 20, name: "dumidu nethmina" },
        { id: 82910, targetBatchId: 20, name: "GOTHIRO SASVIDU" },
        { id: 82917, targetBatchId: 20, name: "Rifdoole" },
        { id: 82937, targetBatchId: 20, name: "Omal Paranavithana" },
        { id: 82939, targetBatchId: 20, name: "Imandi Dissanayake" },
        { id: 27645, targetBatchId: 45, name: "Nethmi Dewmini" },
        { id: 82965, targetBatchId: 20, name: "Haresha Vithanage" },
        { id: 82970, targetBatchId: 45, name: "Kavindi Raveesh" },
        { id: 82979, targetBatchId: 45, name: "Damiru Budmina" },
        { id: 82982, targetBatchId: 45, name: "Lithuli De silva" },
        { id: 82996, targetBatchId: 45, name: "Adheesha Priyangika" },
        { id: 82997, targetBatchId: 20, name: "Damdisa Kulasinghe" },
        { id: 83010, targetBatchId: 45, name: "Tharusha Thathsarani" },
        { id: 83014, targetBatchId: 45, name: "Sanulya Balasuriya" },
        { id: 83028, targetBatchId: 20, name: "Hasindu Priyaruwan" },
        { id: 83030, targetBatchId: 45, name: "Nalinda Lakshitha" },
        { id: 83066, targetBatchId: 41, name: "Agranee Devduni" },
        { id: 93768, targetBatchId: 20, name: "Lead 93768" },
        { id: 100426, targetBatchId: 45, name: "Lead 100426" },
        { id: 116892, targetBatchId: 41, name: "Midu" },
        { id: 39725, targetBatchId: 20, name: "Thisu" },
        { id: 41959, targetBatchId: 45, name: "SJ" },
        { id: 44404, targetBatchId: 20, name: "Sanuka" },
        { id: 25989, targetBatchId: 20, name: "Madon Clair" }
    ];

    // Step 0: Delete dummy backfill records in Batch 20 if needed
    const dummyIds = [48059, 48598, 49253];
    console.log(`Deleting ${dummyIds.length} dummy backfill records:`, dummyIds);
    await prisma.lead.deleteMany({
        where: { id: { in: dummyIds } }
    });

    // Step 1: Move paid students to their respective target batches
    console.log(`Moving ${paidLeadMappings.length} paid leads out of Batch 64 to their actual enrolled batches...`);
    for (const item of paidLeadMappings) {
        await prisma.lead.update({
            where: { id: item.id },
            data: {
                batchId: item.targetBatchId,
                enrollmentStatus: 'ENROLLED',
                paymentIntention: 'PAID',
                openSemCallStatus: 'enrolled',
                callStatus: 'enrolled',
                newInqCallStatus: 'enrolled'
            }
        });
        console.log(` -> Moved Lead ${item.id} (${item.name}) to Batch ${item.targetBatchId}`);
    }

    // Step 2: Fresh-up remaining OPEN_SEMINAR leads in Batch 64
    const paidLeadIds = paidLeadMappings.map(m => m.id);
    console.log("\nDeleting stale round progress records for remaining OPEN_SEMINAR leads in Batch 64...");
    const deletedRounds = await prisma.leadRoundProgress.deleteMany({
        where: {
            lead: {
                batchId: 64,
                campaignType: 'AFTER_SEMINAR',
                inquiryType: 'OPEN_SEMINAR',
                id: { notIn: paidLeadIds }
            }
        }
    });
    console.log(`Deleted ${deletedRounds.count} LeadRoundProgress records.`);

    console.log("Resetting remaining OPEN_SEMINAR leads in Batch 64 to completely fresh state...");
    const updatedRemaining = await prisma.lead.updateMany({
        where: {
            batchId: 64,
            campaignType: 'AFTER_SEMINAR',
            inquiryType: 'OPEN_SEMINAR',
            id: { notIn: paidLeadIds }
        },
        data: {
            openSemCallStatus: 'pending',
            callStatus: 'pending',
            openSemFeedback: '',
            feedback: '',
            openSemRound: 1,
            coordinationRound: 1,
            openSemPhase: 1,
            phase: 1,
            openSemCallAttempt: 1,
            callAttempt: 1,
            openSemCallMethod: null,
            callMethod: null,
            r1DelayedDays: 0,
            r2DelayedDays: 0,
            lastAttemptAt: null,
            nonEnrolledReason: null
        }
    });
    console.log(`Updated ${updatedRemaining.count} OPEN_SEMINAR leads in Batch 64 to fresh pending status.`);

    console.log("=== COMPLETED OL NOVEMBER CAMPAIGN DATA CLEANUP ===");
}

run()
    .catch(e => { console.error("Error running script:", e); process.exit(1); })
    .finally(() => prisma.$disconnect());


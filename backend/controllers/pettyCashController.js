const { PrismaClient } = require('@prisma/client');
const prisma = require('../src/core/db');
const path = require('path');
const fs = require('fs');

// Category whitelist
const ALLOWED_CATEGORIES = [
    'OFFICE_SUPPLIES',
    'REFRESHMENTS',
    'TRAVEL',
    'REPAIRS',
    'MARKETING',
    'UTILITIES',
    'OTHER'
];

// Helper: Role checkers
const getUserRoleUpper = (user) => (user?.role ? String(user.role).toUpperCase().replace(/[\s_-]+/g, '_') : '');
const getUserDeptUpper = (user) => (user?.department ? String(user.department).toUpperCase().replace(/[\s_-]+/g, '_') : '');

const isSystemAdminOrDirector = (user) => {
    const r = getUserRoleUpper(user);
    return ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(r);
};

const isAdminManager = (user) => {
    const r = getUserRoleUpper(user);
    return isSystemAdminOrDirector(user) || r === 'ADMIN_MANAGER';
};

const isFinanceOrPettyCashOfficer = (user) => {
    const r = getUserRoleUpper(user);
    const d = getUserDeptUpper(user);
    return isSystemAdminOrDirector(user) || 
           r === 'PETTY_CASH_OFFICER' || 
           r === 'FINANCE' || 
           d === 'FINANCE';
};

const isManager = (user) => {
    const r = getUserRoleUpper(user);
    return isAdminManager(user) || r === 'MANAGER' || r === 'ASS_MANAGER' || r.includes('MANAGER');
};

// Helper: Safe unique serial generator
const generateSlipNo = (prefix) => {
    const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${dateStr}-${rand}`;
};

// Helper: Record an immutable audit log
const recordAuditLog = async ({ transactionId, user, action, previousStatus, newStatus, comments }) => {
    try {
        const userId = user?.userId || user?.id || null;
        const userName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : (user?.name || `User #${userId}`);
        const userRole = user?.role || 'Staff';

        await prisma.pettyCashAuditLog.create({
            data: {
                transactionId: transactionId ? parseInt(transactionId) : null,
                userId: userId ? parseInt(userId) : null,
                userName,
                userRole,
                action,
                previousStatus: previousStatus || null,
                newStatus: newStatus || null,
                comments: comments || null
            }
        });
    } catch (err) {
        console.error("[PettyCash Audit Error]:", err);
    }
};

// Helper: Ensure every active business has a PettyCashAccount record
const ensurePettyCashAccounts = async () => {
    const businesses = await prisma.business.findMany({ select: { id: true, name: true } });
    for (const biz of businesses) {
        await prisma.pettyCashAccount.upsert({
            where: { businessId: biz.id },
            update: {},
            create: {
                businessId: biz.id,
                fundLimit: 50000.0,
                currentBalance: 0.0,
                minBalanceThreshold: 10000.0,
                status: 'ACTIVE'
            }
        });
    }
};

// ==============================================================
// 1. DASHBOARD & STATS
// ==============================================================
exports.getDashboardStats = async (req, res) => {
    try {
        await ensurePettyCashAccounts();

        const user = req.user;
        const roleUpper = getUserRoleUpper(user);
        const isFin = isFinanceOrPettyCashOfficer(user);
        const isAdm = isAdminManager(user);
        const isSys = isSystemAdminOrDirector(user);

        // Filter by user's assigned businesses if regular branch manager
        let businessFilter = {};
        if (!isSys && !isAdm && !isFin && user.businessType) {
            const bizArray = String(user.businessType).split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
            const allBiz = await prisma.business.findMany({ select: { id: true, name: true } });
            const matchingIds = allBiz
                .filter(b => bizArray.includes(b.name.trim().toLowerCase()) || bizArray.includes(String(b.id)))
                .map(b => b.id);
            if (matchingIds.length > 0) {
                businessFilter = { businessId: { in: matchingIds } };
            }
        }

        const [
            pendingApprovalCount,
            approvedCount,
            cashIssuedCount,
            receiptSubmittedCount,
            settledCount,
            totalTransactionsCount,
            accounts
        ] = await Promise.all([
            prisma.pettyCashTransaction.count({ where: { ...businessFilter, status: 'PENDING_APPROVAL' } }),
            prisma.pettyCashTransaction.count({ where: { ...businessFilter, status: 'APPROVED' } }),
            prisma.pettyCashTransaction.count({ where: { ...businessFilter, status: 'CASH_ISSUED' } }),
            prisma.pettyCashTransaction.count({ where: { ...businessFilter, status: 'RECEIPT_SUBMITTED' } }),
            prisma.pettyCashTransaction.count({ where: { ...businessFilter, status: 'SETTLED' } }),
            prisma.pettyCashTransaction.count({ where: businessFilter }),
            prisma.pettyCashAccount.findMany({
                where: businessFilter,
                include: { business: { select: { id: true, name: true, logo: true } } }
            })
        ]);

        const totalFundBalance = accounts.reduce((sum, a) => sum + (a.currentBalance || 0), 0);
        const lowBalanceAccounts = accounts.filter(a => a.currentBalance <= a.minBalanceThreshold);

        res.status(200).json({
            pendingApprovalCount,
            approvedCount,
            cashIssuedCount,
            receiptSubmittedCount,
            settledCount,
            totalTransactionsCount,
            totalFundBalance,
            lowBalanceAccountsCount: lowBalanceAccounts.length,
            accounts
        });
    } catch (err) {
        console.error("getDashboardStats error:", err);
        res.status(500).json({ error: "Failed to load petty cash dashboard stats" });
    }
};

// ==============================================================
// 2. PETTY CASH ACCOUNTS & RELOAD ELIGIBILITY
// ==============================================================
exports.getAccounts = async (req, res) => {
    try {
        await ensurePettyCashAccounts();

        const user = req.user;
        const isFin = isFinanceOrPettyCashOfficer(user);
        const isAdm = isAdminManager(user);
        const isSys = isSystemAdminOrDirector(user);

        let where = {};
        if (!isSys && !isAdm && !isFin && user.businessType) {
            const bizArray = String(user.businessType).split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
            const allBiz = await prisma.business.findMany({ select: { id: true, name: true } });
            const matchingIds = allBiz
                .filter(b => bizArray.includes(b.name.trim().toLowerCase()) || bizArray.includes(String(b.id)))
                .map(b => b.id);
            if (matchingIds.length > 0) where = { businessId: { in: matchingIds } };
        }

        const accounts = await prisma.pettyCashAccount.findMany({
            where,
            include: {
                business: { select: { id: true, name: true, logo: true } },
                _count: {
                    select: {
                        transactions: {
                            where: { status: { in: ['CASH_ISSUED', 'RECEIPT_SUBMITTED', 'RETURNED_FOR_CORRECTION'] } }
                        }
                    }
                }
            },
            orderBy: { business: { name: 'asc' } }
        });

        // Compute reload eligibility for each business account:
        // Reload is blocked if there are unsettled transactions or missing receipts!
        const accountsWithEligibility = accounts.map(acc => {
            const unsettledCount = acc._count.transactions || 0;
            return {
                ...acc,
                unsettledCount,
                reloadEligible: unsettledCount === 0,
                isLowBalance: acc.currentBalance <= acc.minBalanceThreshold
            };
        });

        res.status(200).json(accountsWithEligibility);
    } catch (err) {
        console.error("getAccounts error:", err);
        res.status(500).json({ error: "Failed to load accounts" });
    }
};

exports.updateAccountSettings = async (req, res) => {
    try {
        const user = req.user;
        if (!isFinanceOrPettyCashOfficer(user) && !isAdminManager(user)) {
            return res.status(403).json({ error: "Access denied. Only Finance or Admin Manager can adjust fund limits." });
        }

        const { id } = req.params;
        const { fundLimit, minBalanceThreshold, status } = req.body;

        const updated = await prisma.pettyCashAccount.update({
            where: { id: parseInt(id) },
            data: {
                fundLimit: fundLimit !== undefined ? parseFloat(fundLimit) : undefined,
                minBalanceThreshold: minBalanceThreshold !== undefined ? parseFloat(minBalanceThreshold) : undefined,
                status: status || undefined
            },
            include: { business: true }
        });

        await recordAuditLog({
            user,
            action: 'ACCOUNT_SETTINGS_UPDATED',
            comments: `Fund settings updated for ${updated.business.name}. Limit: Rs. ${updated.fundLimit}, Threshold: Rs. ${updated.minBalanceThreshold}`
        });

        res.status(200).json(updated);
    } catch (err) {
        console.error("updateAccountSettings error:", err);
        res.status(500).json({ error: "Failed to update account settings" });
    }
};

// ==============================================================
// 3. TRANSACTIONS LIST & DETAILS
// ==============================================================
exports.getTransactions = async (req, res) => {
    try {
        const user = req.user;
        const { businessId, status, category, search, startDate, endDate } = req.query;

        const isFin = isFinanceOrPettyCashOfficer(user);
        const isAdm = isAdminManager(user);
        const isSys = isSystemAdminOrDirector(user);

        let where = {};

        // Scope by business permissions
        if (!isSys && !isAdm && !isFin) {
            if (user.businessType) {
                const bizArray = String(user.businessType).split(',').map(b => b.trim().toLowerCase()).filter(Boolean);
                const allBiz = await prisma.business.findMany({ select: { id: true, name: true } });
                const matchingIds = allBiz
                    .filter(b => bizArray.includes(b.name.trim().toLowerCase()) || bizArray.includes(String(b.id)))
                    .map(b => b.id);
                where.businessId = { in: matchingIds };
            } else {
                where.requesterId = user.userId || user.id;
            }
        }

        if (businessId && businessId !== 'ALL') {
            where.businessId = parseInt(businessId);
        }

        if (status && status !== 'ALL') {
            where.status = status;
        }

        if (category && category !== 'ALL') {
            where.category = category;
        }

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.createdAt.lte = end;
            }
        }

        if (search && search.trim()) {
            const term = search.trim();
            where.OR = [
                { transactionNo: { contains: term } },
                { purpose: { contains: term } },
                { requestSlipNo: { contains: term } },
                { approvalSlipNo: { contains: term } },
                { cashIssueSlipNo: { contains: term } },
                { finalSettlementSlipNo: { contains: term } },
                { vendorName: { contains: term } },
                { receiptNo: { contains: term } },
                { requester: { firstName: { contains: term } } },
                { requester: { lastName: { contains: term } } }
            ];
        }

        const transactions = await prisma.pettyCashTransaction.findMany({
            where,
            include: {
                business: { select: { id: true, name: true, logo: true } },
                requester: { select: { id: true, firstName: true, lastName: true, phone: true, role: true } },
                adminManager: { select: { id: true, firstName: true, lastName: true, role: true } },
                issuedByOfficer: { select: { id: true, firstName: true, lastName: true, role: true } },
                verifiedByOfficer: { select: { id: true, firstName: true, lastName: true, role: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.status(200).json(transactions);
    } catch (err) {
        console.error("getTransactions error:", err);
        res.status(500).json({ error: "Failed to load transactions" });
    }
};

exports.getTransactionById = async (req, res) => {
    try {
        const { id } = req.params;
        const tx = await prisma.pettyCashTransaction.findUnique({
            where: { id: parseInt(id) },
            include: {
                business: true,
                account: true,
                requester: { select: { id: true, firstName: true, lastName: true, phone: true, role: true, department: true } },
                adminManager: { select: { id: true, firstName: true, lastName: true, role: true } },
                issuedByOfficer: { select: { id: true, firstName: true, lastName: true, role: true } },
                verifiedByOfficer: { select: { id: true, firstName: true, lastName: true, role: true } },
                auditLogs: { orderBy: { createdAt: 'asc' } }
            }
        });

        if (!tx) return res.status(404).json({ error: "Petty cash transaction not found" });

        res.status(200).json(tx);
    } catch (err) {
        console.error("getTransactionById error:", err);
        res.status(500).json({ error: "Failed to load transaction details" });
    }
};

// ==============================================================
// 4. STEP 1: CREATE REQUEST (MANAGER)
// ==============================================================
exports.createRequest = async (req, res) => {
    try {
        const user = req.user;
        const requesterId = user.userId || user.id;

        const { businessId, category, requestedAmount, purpose, requiredDate, additionalNotes } = req.body;

        if (!businessId) return res.status(400).json({ error: "Business selection is required." });
        if (!category || !ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: "A valid expense category is required." });
        }
        const parsedAmount = parseFloat(requestedAmount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: "Requested amount must be greater than zero." });
        }
        if (!purpose || !purpose.trim()) {
            return res.status(400).json({ error: "Purpose / Description is required." });
        }
        if (!requiredDate) {
            return res.status(400).json({ error: "Required date is required." });
        }

        // Ensure business has an account
        let account = await prisma.pettyCashAccount.findUnique({ where: { businessId: parseInt(businessId) } });
        if (!account) {
            account = await prisma.pettyCashAccount.create({
                data: {
                    businessId: parseInt(businessId),
                    fundLimit: 50000.0,
                    currentBalance: 0.0,
                    minBalanceThreshold: 10000.0
                }
            });
        }

        const transactionNo = generateSlipNo('PCT');
        const requestSlipNo = generateSlipNo('REQ-ESLIP');

        const transaction = await prisma.pettyCashTransaction.create({
            data: {
                transactionNo,
                businessId: parseInt(businessId),
                accountId: account.id,
                requesterId: parseInt(requesterId),
                status: 'PENDING_APPROVAL',
                category,
                requestedAmount: parsedAmount,
                purpose: purpose.trim(),
                requiredDate: new Date(requiredDate),
                additionalNotes: additionalNotes ? additionalNotes.trim() : null,
                requestSlipNo,
                requestedAt: new Date()
            },
            include: {
                business: true,
                requester: { select: { firstName: true, lastName: true } }
            }
        });

        // Audit Log
        await recordAuditLog({
            transactionId: transaction.id,
            user,
            action: 'REQUEST_CREATED',
            previousStatus: null,
            newStatus: 'PENDING_APPROVAL',
            comments: `Created request ${transactionNo} for Rs. ${parsedAmount.toFixed(2)} (${category}). Purpose: ${purpose.trim()}`
        });

        res.status(201).json({
            message: "Petty cash request submitted successfully. Request E-Slip generated.",
            transaction
        });
    } catch (err) {
        console.error("createRequest error:", err);
        res.status(500).json({ error: "Failed to submit petty cash request" });
    }
};

// ==============================================================
// 5. STEP 2: ADMIN MANAGER REVIEW (APPROVE / REJECT / RETURN)
// ==============================================================
exports.reviewRequest = async (req, res) => {
    try {
        const user = req.user;
        if (!isAdminManager(user)) {
            return res.status(403).json({ error: "Access denied. Only Admin Manager or Director can review petty cash requests." });
        }

        const { id } = req.params;
        const { action, approvedAmount, approvalComments, rejectionReason, returnForChangesNote } = req.body;

        const tx = await prisma.pettyCashTransaction.findUnique({ where: { id: parseInt(id) } });
        if (!tx) return res.status(404).json({ error: "Transaction not found." });

        if (tx.status !== 'PENDING_APPROVAL') {
            return res.status(400).json({ error: `Transaction is currently '${tx.status}' and cannot be reviewed.` });
        }

        const adminId = user.userId || user.id;

        if (action === 'APPROVE') {
            const parsedApprovedAmt = approvedAmount !== undefined ? parseFloat(approvedAmount) : tx.requestedAmount;
            if (isNaN(parsedApprovedAmt) || parsedApprovedAmt <= 0) {
                return res.status(400).json({ error: "Approved amount must be greater than zero." });
            }

            const approvalSlipNo = generateSlipNo('APP-ESLIP');

            const updated = await prisma.pettyCashTransaction.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'APPROVED',
                    adminManagerId: parseInt(adminId),
                    approvedAmount: parsedApprovedAmt,
                    approvalComments: approvalComments ? approvalComments.trim() : null,
                    approvalSlipNo,
                    approvedAt: new Date()
                },
                include: { business: true, requester: true }
            });

            await recordAuditLog({
                transactionId: tx.id,
                user,
                action: 'REQUEST_APPROVED',
                previousStatus: 'PENDING_APPROVAL',
                newStatus: 'APPROVED',
                comments: `Approved for Rs. ${parsedApprovedAmt.toFixed(2)} (Requested: Rs. ${tx.requestedAmount.toFixed(2)}). E-Slip: ${approvalSlipNo}. Comments: ${approvalComments || 'None'}`
            });

            return res.status(200).json({
                message: "Request approved successfully. Approval E-Slip generated.",
                transaction: updated
            });

        } else if (action === 'REJECT') {
            if (!rejectionReason || !rejectionReason.trim()) {
                return res.status(400).json({ error: "Rejection reason is required." });
            }

            const updated = await prisma.pettyCashTransaction.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'REJECTED',
                    adminManagerId: parseInt(adminId),
                    rejectionReason: rejectionReason.trim(),
                    approvedAt: new Date()
                }
            });

            await recordAuditLog({
                transactionId: tx.id,
                user,
                action: 'REQUEST_REJECTED',
                previousStatus: 'PENDING_APPROVAL',
                newStatus: 'REJECTED',
                comments: `Rejected by Admin Manager. Reason: ${rejectionReason.trim()}`
            });

            return res.status(200).json({
                message: "Request rejected.",
                transaction: updated
            });

        } else if (action === 'RETURN_FOR_CHANGES') {
            if (!returnForChangesNote || !returnForChangesNote.trim()) {
                return res.status(400).json({ error: "Comments explaining required changes are required." });
            }

            const updated = await prisma.pettyCashTransaction.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'RETURNED_FOR_CHANGES',
                    adminManagerId: parseInt(adminId),
                    returnForChangesNote: returnForChangesNote.trim()
                }
            });

            await recordAuditLog({
                transactionId: tx.id,
                user,
                action: 'REQUEST_RETURNED_FOR_CHANGES',
                previousStatus: 'PENDING_APPROVAL',
                newStatus: 'RETURNED_FOR_CHANGES',
                comments: `Returned for changes. Feedback: ${returnForChangesNote.trim()}`
            });

            return res.status(200).json({
                message: "Request returned to Manager for modifications.",
                transaction: updated
            });

        } else {
            return res.status(400).json({ error: "Invalid action. Choose APPROVE, REJECT, or RETURN_FOR_CHANGES." });
        }

    } catch (err) {
        console.error("reviewRequest error:", err);
        res.status(500).json({ error: "Failed to process request review" });
    }
};

// Manager resubmits returned request
exports.updateAndResubmitRequest = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { category, requestedAmount, purpose, requiredDate, additionalNotes } = req.body;

        const tx = await prisma.pettyCashTransaction.findUnique({ where: { id: parseInt(id) } });
        if (!tx) return res.status(404).json({ error: "Transaction not found." });

        if (tx.status !== 'RETURNED_FOR_CHANGES') {
            return res.status(400).json({ error: "Only requests returned for changes can be edited and resubmitted." });
        }

        const parsedAmount = requestedAmount !== undefined ? parseFloat(requestedAmount) : tx.requestedAmount;
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: "Requested amount must be greater than zero." });
        }

        const updated = await prisma.pettyCashTransaction.update({
            where: { id: parseInt(id) },
            data: {
                status: 'PENDING_APPROVAL',
                category: category || tx.category,
                requestedAmount: parsedAmount,
                purpose: purpose ? purpose.trim() : tx.purpose,
                requiredDate: requiredDate ? new Date(requiredDate) : tx.requiredDate,
                additionalNotes: additionalNotes ? additionalNotes.trim() : tx.additionalNotes,
                returnForChangesNote: null,
                requestedAt: new Date()
            }
        });

        await recordAuditLog({
            transactionId: tx.id,
            user,
            action: 'REQUEST_RESUBMITTED',
            previousStatus: 'RETURNED_FOR_CHANGES',
            newStatus: 'PENDING_APPROVAL',
            comments: `Resubmitted modified request with amount Rs. ${parsedAmount.toFixed(2)}.`
        });

        res.status(200).json({
            message: "Request modified and resubmitted for Admin Manager review.",
            transaction: updated
        });
    } catch (err) {
        console.error("updateAndResubmitRequest error:", err);
        res.status(500).json({ error: "Failed to resubmit request" });
    }
};

// ==============================================================
// 6. STEP 3: CASH ISSUE (PETTY CASH OFFICER - FINANCE)
// ==============================================================
exports.issueCash = async (req, res) => {
    try {
        const user = req.user;
        if (!isFinanceOrPettyCashOfficer(user)) {
            return res.status(403).json({ error: "Access denied. Only Finance Petty Cash Officer can disburse cash." });
        }

        const { id } = req.params;
        const officerId = user.userId || user.id;

        const tx = await prisma.pettyCashTransaction.findUnique({
            where: { id: parseInt(id) },
            include: { business: true, account: true, requester: true }
        });
        if (!tx) return res.status(404).json({ error: "Transaction not found." });

        if (tx.status !== 'APPROVED') {
            return res.status(400).json({ error: `Cash can only be issued for APPROVED requests (current: ${tx.status}).` });
        }

        const amountToIssue = tx.approvedAmount || tx.requestedAmount;

        // Check Business Available Balance
        const account = await prisma.pettyCashAccount.findUnique({ where: { id: tx.accountId } });
        if (!account) return res.status(404).json({ error: "Petty cash account for this business not found." });

        if (account.currentBalance < amountToIssue) {
            return res.status(400).json({
                error: `Insufficient petty cash balance in ${tx.business.name}. Available Balance: Rs. ${account.currentBalance.toLocaleString('en-LK', { minimumFractionDigits: 2 })}, Required: Rs. ${amountToIssue.toLocaleString('en-LK', { minimumFractionDigits: 2 })}. Please perform a petty cash reload first.`
            });
        }

        const cashIssueSlipNo = generateSlipNo('ISS-ESLIP');

        // Execute atomic update: deduct from account balance and mark transaction as CASH_ISSUED
        const [updatedTx, updatedAccount] = await prisma.$transaction([
            prisma.pettyCashTransaction.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'CASH_ISSUED',
                    issuedByOfficerId: parseInt(officerId),
                    cashIssuedAmount: amountToIssue,
                    cashIssueSlipNo,
                    cashIssuedAt: new Date()
                },
                include: { business: true, requester: true }
            }),
            prisma.pettyCashAccount.update({
                where: { id: account.id },
                data: {
                    currentBalance: { decrement: amountToIssue }
                }
            })
        ]);

        await recordAuditLog({
            transactionId: tx.id,
            user,
            action: 'CASH_ISSUED',
            previousStatus: 'APPROVED',
            newStatus: 'CASH_ISSUED',
            comments: `Issued cash Rs. ${amountToIssue.toFixed(2)} to ${tx.requester.firstName} ${tx.requester.lastName}. Remaining Balance: Rs. ${updatedAccount.currentBalance.toFixed(2)}. Slip: ${cashIssueSlipNo}`
        });

        res.status(200).json({
            message: "Cash issued successfully. Cash Issue E-Slip generated.",
            transaction: updatedTx,
            newBalance: updatedAccount.currentBalance
        });
    } catch (err) {
        console.error("issueCash error:", err);
        res.status(500).json({ error: "Failed to issue cash" });
    }
};

// Manager Digital Confirmation of cash received
exports.confirmCashReceived = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const currentUserId = user.userId || user.id;

        const tx = await prisma.pettyCashTransaction.findUnique({ where: { id: parseInt(id) } });
        if (!tx) return res.status(404).json({ error: "Transaction not found." });

        if (tx.status !== 'CASH_ISSUED') {
            return res.status(400).json({ error: "Confirmation is only available when status is CASH_ISSUED." });
        }

        // Only requester or manager/admin can confirm
        if (tx.requesterId !== currentUserId && !isAdminManager(user)) {
            return res.status(403).json({ error: "Only the requester can confirm receipt of cash." });
        }

        const updated = await prisma.pettyCashTransaction.update({
            where: { id: parseInt(id) },
            data: {
                cashReceivedConfirmed: true,
                cashReceivedAt: new Date()
            }
        });

        await recordAuditLog({
            transactionId: tx.id,
            user,
            action: 'CASH_RECEIVED_CONFIRMED',
            previousStatus: 'CASH_ISSUED',
            newStatus: 'CASH_ISSUED',
            comments: `Requester digitally confirmed receipt of Rs. ${(tx.cashIssuedAmount || 0).toFixed(2)}.`
        });

        res.status(200).json({
            message: "Cash receipt confirmed successfully.",
            transaction: updated
        });
    } catch (err) {
        console.error("confirmCashReceived error:", err);
        res.status(500).json({ error: "Failed to confirm cash receipt" });
    }
};

// ==============================================================
// 7. STEP 4: EXPENSE & MANDATORY RECEIPT SUBMISSION (MANAGER)
// ==============================================================
exports.submitExpenseReceipt = async (req, res) => {
    try {
        const user = req.user;
        const { id } = req.params;
        const { actualSpentAmount, receiptNo, vendorName, expenseDate, expenseDescription } = req.body;

        const tx = await prisma.pettyCashTransaction.findUnique({ where: { id: parseInt(id) } });
        if (!tx) return res.status(404).json({ error: "Transaction not found." });

        if (tx.status !== 'CASH_ISSUED' && tx.status !== 'RETURNED_FOR_CORRECTION') {
            return res.status(400).json({ error: `Cannot submit receipts when status is ${tx.status}.` });
        }

        const parsedSpent = parseFloat(actualSpentAmount);
        if (isNaN(parsedSpent) || parsedSpent < 0) {
            return res.status(400).json({ error: "Actual spent amount must be a valid number >= 0." });
        }

        // Receipt attachment is MANDATORY!
        let receiptAttachment = tx.receiptAttachment;
        if (req.file) {
            receiptAttachment = `/storage/petty_cash/${req.file.filename}`;
        }

        if (!receiptAttachment) {
            return res.status(400).json({ error: "Receipt or Invoice document upload is MANDATORY to submit an expense." });
        }

        const cashIssued = tx.cashIssuedAmount || tx.approvedAmount || 0;
        const cashReturned = Math.max(0, cashIssued - parsedSpent);

        const updated = await prisma.pettyCashTransaction.update({
            where: { id: parseInt(id) },
            data: {
                status: 'RECEIPT_SUBMITTED',
                actualSpentAmount: parsedSpent,
                cashReturnedAmount: cashReturned,
                receiptNo: receiptNo ? receiptNo.trim() : null,
                vendorName: vendorName ? vendorName.trim() : null,
                expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
                expenseDescription: expenseDescription ? expenseDescription.trim() : null,
                receiptAttachment,
                receiptSubmittedAt: new Date(),
                returnCorrectionNote: null
            },
            include: { business: true }
        });

        await recordAuditLog({
            transactionId: tx.id,
            user,
            action: 'RECEIPT_SUBMITTED',
            previousStatus: tx.status,
            newStatus: 'RECEIPT_SUBMITTED',
            comments: `Submitted receipt #${receiptNo || 'N/A'} for Rs. ${parsedSpent.toFixed(2)}. Cash Returned: Rs. ${cashReturned.toFixed(2)}. Vendor: ${vendorName || 'N/A'}`
        });

        res.status(200).json({
            message: "Receipt and expense details submitted successfully for Finance verification.",
            transaction: updated
        });
    } catch (err) {
        console.error("submitExpenseReceipt error:", err);
        res.status(500).json({ error: "Failed to submit receipt details" });
    }
};

// ==============================================================
// 8. STEP 5: RECEIPT VERIFICATION & FINAL SETTLEMENT (FINANCE)
// ==============================================================
exports.verifyReceipt = async (req, res) => {
    try {
        const user = req.user;
        if (!isFinanceOrPettyCashOfficer(user)) {
            return res.status(403).json({ error: "Access denied. Only Finance Petty Cash Officer can verify receipts." });
        }

        const { id } = req.params;
        const { decision, verificationComments, returnCorrectionNote } = req.body;
        const officerId = user.userId || user.id;

        const tx = await prisma.pettyCashTransaction.findUnique({
            where: { id: parseInt(id) },
            include: { account: true, business: true, requester: true }
        });
        if (!tx) return res.status(404).json({ error: "Transaction not found." });

        if (tx.status !== 'RECEIPT_SUBMITTED') {
            return res.status(400).json({ error: `Cannot verify receipt when status is ${tx.status}.` });
        }

        if (decision === 'RETURN_FOR_CORRECTION') {
            if (!returnCorrectionNote || !returnCorrectionNote.trim()) {
                return res.status(400).json({ error: "Correction feedback note is required." });
            }

            const updated = await prisma.pettyCashTransaction.update({
                where: { id: parseInt(id) },
                data: {
                    status: 'RETURNED_FOR_CORRECTION',
                    verifiedByOfficerId: parseInt(officerId),
                    returnCorrectionNote: returnCorrectionNote.trim()
                }
            });

            await recordAuditLog({
                transactionId: tx.id,
                user,
                action: 'RECEIPT_RETURNED_FOR_CORRECTION',
                previousStatus: 'RECEIPT_SUBMITTED',
                newStatus: 'RETURNED_FOR_CORRECTION',
                comments: `Receipt returned for correction. Note: ${returnCorrectionNote.trim()}`
            });

            return res.status(200).json({
                message: "Receipt returned to Manager for correction.",
                transaction: updated
            });

        } else if (decision === 'VERIFY_AND_SETTLE') {
            const finalSettlementSlipNo = generateSlipNo('SET-ESLIP');
            const cashReturned = tx.cashReturnedAmount || 0;

            // Atomic transaction:
            // 1. Mark transaction as SETTLED
            // 2. If cash was returned, credit it back to the business PettyCashAccount.currentBalance!
            const [updatedTx, updatedAccount] = await prisma.$transaction([
                prisma.pettyCashTransaction.update({
                    where: { id: parseInt(id) },
                    data: {
                        status: 'SETTLED',
                        verifiedByOfficerId: parseInt(officerId),
                        verificationComments: verificationComments ? verificationComments.trim() : null,
                        finalSettlementSlipNo,
                        verifiedAt: new Date(),
                        settledAt: new Date()
                    },
                    include: { business: true, requester: true }
                }),
                cashReturned > 0
                    ? prisma.pettyCashAccount.update({
                        where: { id: tx.accountId },
                        data: {
                            currentBalance: { increment: cashReturned }
                        }
                    })
                    : prisma.pettyCashAccount.findUnique({ where: { id: tx.accountId } })
            ]);

            await recordAuditLog({
                transactionId: tx.id,
                user,
                action: 'TRANSACTION_SETTLED',
                previousStatus: 'RECEIPT_SUBMITTED',
                newStatus: 'SETTLED',
                comments: `Verified & Settled. Actual Spent: Rs. ${(tx.actualSpentAmount || 0).toFixed(2)}, Returned: Rs. ${cashReturned.toFixed(2)}. Final Slip: ${finalSettlementSlipNo}`
            });

            return res.status(200).json({
                message: "Transaction verified and settled successfully. Final Settlement E-Slip generated.",
                transaction: updatedTx,
                accountBalance: updatedAccount.currentBalance
            });

        } else {
            return res.status(400).json({ error: "Invalid decision. Choose VERIFY_AND_SETTLE or RETURN_FOR_CORRECTION." });
        }

    } catch (err) {
        console.error("verifyReceipt error:", err);
        res.status(500).json({ error: "Failed to verify receipt" });
    }
};

// ==============================================================
// 9. PETTY CASH RELOAD PROCESS
// ==============================================================
exports.initiateReload = async (req, res) => {
    try {
        const user = req.user;
        if (!isFinanceOrPettyCashOfficer(user) && !isSystemAdminOrDirector(user)) {
            return res.status(403).json({ error: "Access denied. Only Finance Petty Cash Officer can reload petty cash funds." });
        }

        const { businessId, amount, notes, forceOverride } = req.body;
        const performedById = user.userId || user.id;

        if (!businessId) return res.status(400).json({ error: "Business ID is required." });
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: "Reload amount must be greater than zero." });
        }

        const biz = await prisma.business.findUnique({
            where: { id: parseInt(businessId) },
            include: { pettyCashAccount: true }
        });
        if (!biz) return res.status(404).json({ error: "Business not found." });

        let account = biz.pettyCashAccount;
        if (!account) {
            account = await prisma.pettyCashAccount.create({
                data: {
                    businessId: biz.id,
                    fundLimit: 50000.0,
                    currentBalance: 0.0,
                    minBalanceThreshold: 10000.0
                }
            });
        }

        // 🛡️ PRE-RELOAD SAFETY CHECK:
        // System Requirement 9:
        // Check if all issued cash transactions are settled and receipts uploaded.
        // Block reload if unsettled transactions exist unless forceOverride is specifically approved.
        const unsettledTransactions = await prisma.pettyCashTransaction.findMany({
            where: {
                businessId: biz.id,
                status: { in: ['CASH_ISSUED', 'RECEIPT_SUBMITTED', 'RETURNED_FOR_CORRECTION'] }
            },
            select: {
                id: true,
                transactionNo: true,
                requestedAmount: true,
                cashIssuedAmount: true,
                status: true,
                requester: { select: { firstName: true, lastName: true } }
            }
        });

        if (unsettledTransactions.length > 0 && !forceOverride) {
            return res.status(400).json({
                error: `Petty cash reload is blocked! ${unsettledTransactions.length} transaction(s) have unsettled cash or missing receipt verification.`,
                unsettledCount: unsettledTransactions.length,
                unsettledTransactions
            });
        }

        const previousBalance = account.currentBalance;
        const newBalance = previousBalance + parsedAmount;
        const reloadNo = generateSlipNo('PCR');

        const [reloadRecord, updatedAccount] = await prisma.$transaction([
            prisma.pettyCashReload.create({
                data: {
                    reloadNo,
                    businessId: biz.id,
                    accountId: account.id,
                    amount: parsedAmount,
                    previousBalance,
                    newBalance,
                    performedById: parseInt(performedById),
                    notes: notes ? notes.trim() : null
                }
            }),
            prisma.pettyCashAccount.update({
                where: { id: account.id },
                data: {
                    currentBalance: newBalance
                }
            })
        ]);

        await recordAuditLog({
            user,
            action: 'FUND_RELOADED',
            comments: `Reloaded Rs. ${parsedAmount.toFixed(2)} to ${biz.name}. Previous: Rs. ${previousBalance.toFixed(2)}, New Balance: Rs. ${newBalance.toFixed(2)}. Reload Ref: ${reloadNo}. Notes: ${notes || 'None'}`
        });

        res.status(200).json({
            message: `Petty cash fund for ${biz.name} reloaded successfully.`,
            reload: reloadRecord,
            account: updatedAccount
        });

    } catch (err) {
        console.error("initiateReload error:", err);
        res.status(500).json({ error: "Failed to reload petty cash fund" });
    }
};

exports.getReloadHistory = async (req, res) => {
    try {
        const { businessId } = req.query;
        let where = {};
        if (businessId && businessId !== 'ALL') {
            where.businessId = parseInt(businessId);
        }

        const reloads = await prisma.pettyCashReload.findMany({
            where,
            include: {
                business: { select: { id: true, name: true, logo: true } },
                performedBy: { select: { firstName: true, lastName: true, role: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.status(200).json(reloads);
    } catch (err) {
        console.error("getReloadHistory error:", err);
        res.status(500).json({ error: "Failed to fetch reload history" });
    }
};

// ==============================================================
// 10. AUDIT TRAIL LOGS (IMMUTABLE)
// ==============================================================
exports.getAuditLogs = async (req, res) => {
    try {
        const { transactionId, limit } = req.query;
        let where = {};
        if (transactionId) {
            where.transactionId = parseInt(transactionId);
        }

        const logs = await prisma.pettyCashAuditLog.findMany({
            where,
            include: {
                transaction: { select: { id: true, transactionNo: true, businessId: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: limit ? parseInt(limit) : 200
        });

        res.status(200).json(logs);
    } catch (err) {
        console.error("getAuditLogs error:", err);
        res.status(500).json({ error: "Failed to load audit logs" });
    }
};


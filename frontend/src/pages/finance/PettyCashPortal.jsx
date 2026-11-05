import React, { useState, useEffect, useRef } from 'react';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import { 
    Wallet, Plus, Search, Filter, RefreshCw, CheckCircle2, XCircle, AlertTriangle, 
    Clock, FileText, ArrowRight, Upload, Eye, Download, History, Printer, ShieldAlert,
    Building2, DollarSign, Calendar, User, Tag, ChevronRight, AlertCircle, ArrowUpRight,
    TrendingDown, Sparkles, Check, X, RotateCcw, Lock
} from 'lucide-react';

const CATEGORIES = [
    { id: 'OFFICE_SUPPLIES', label: 'Office Supplies & Stationery', color: 'blue' },
    { id: 'REFRESHMENTS', label: 'Staff & Guest Refreshments', color: 'amber' },
    { id: 'TRAVEL', label: 'Travel & Local Transport', color: 'emerald' },
    { id: 'REPAIRS', label: 'Maintenance & Repairs', color: 'rose' },
    { id: 'MARKETING', label: 'Marketing & Promotions', color: 'purple' },
    { id: 'UTILITIES', label: 'Utilities & Petty Bills', color: 'cyan' },
    { id: 'OTHER', label: 'Other Operational Expenses', color: 'slate' }
];

export default function PettyCashPortal({ loggedInUser }) {
    const currentUser = loggedInUser || (() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch (e) {
            return {};
        }
    })();

    // Role Determination
    const userRole = (currentUser?.role || '').toUpperCase().replace(/[\s_-]+/g, '_');
    const userDept = (currentUser?.department || '').toUpperCase().replace(/[\s_-]+/g, '_');

    const isSystemAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN'].includes(userRole);
    const isAdminManager = isSystemAdmin || userRole === 'ADMIN_MANAGER';
    const isFinance = isSystemAdmin || userRole === 'PETTY_CASH_OFFICER' || userRole === 'FINANCE' || userDept === 'FINANCE';
    const isBranchManager = isAdminManager || userRole === 'MANAGER' || userRole === 'ASS_MANAGER' || userRole.includes('MANAGER');

    // Tab state: 'workflow' | 'accounts' | 'audit'
    const [activeTab, setActiveTab] = useState('workflow');

    // Data state
    const [stats, setStats] = useState(null);
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [reloadHistory, setReloadHistory] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [businessFilter, setBusinessFilter] = useState('ALL');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [showNewRequestModal, setShowNewRequestModal] = useState(false);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [showIssueCashModal, setShowIssueCashModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [showESlipModal, setShowESlipModal] = useState(false);
    const [showAuditModal, setShowAuditModal] = useState(false);
    const [showReloadModal, setShowReloadModal] = useState(false);
    const [selectedTx, setSelectedTx] = useState(null);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [eSlipActiveTab, setESlipActiveTab] = useState('request'); // 'request' | 'approval' | 'issue' | 'settlement'

    // Form States
    const [requestForm, setRequestForm] = useState({
        businessId: '',
        category: 'OFFICE_SUPPLIES',
        requestedAmount: '',
        purpose: '',
        requiredDate: new Date().toISOString().split('T')[0],
        additionalNotes: ''
    });

    const [reviewForm, setReviewForm] = useState({
        action: 'APPROVE', // 'APPROVE' | 'REJECT' | 'RETURN_FOR_CHANGES'
        approvedAmount: '',
        approvalComments: '',
        rejectionReason: '',
        returnForChangesNote: ''
    });

    const [receiptForm, setReceiptForm] = useState({
        actualSpentAmount: '',
        receiptNo: '',
        vendorName: '',
        expenseDate: new Date().toISOString().split('T')[0],
        expenseDescription: '',
        receiptFile: null
    });

    const [verifyForm, setVerifyForm] = useState({
        decision: 'VERIFY_AND_SETTLE', // 'VERIFY_AND_SETTLE' | 'RETURN_FOR_CORRECTION'
        verificationComments: '',
        returnCorrectionNote: ''
    });

    const [reloadForm, setReloadForm] = useState({
        amount: '',
        notes: '',
        forceOverride: false
    });

    const [submitting, setSubmitting] = useState(false);

    // Initial Fetch
    useEffect(() => {
        fetchAllData();
    }, [statusFilter, businessFilter, categoryFilter]);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [statsRes, accountsRes, txRes] = await Promise.all([
                api.get('/petty-cash/dashboard'),
                api.get('/petty-cash/accounts'),
                api.get('/petty-cash/transactions', {
                    params: {
                        status: statusFilter,
                        businessId: businessFilter,
                        category: categoryFilter,
                        search: searchQuery
                    }
                })
            ]);
            setStats(statsRes.data || null);
            setAccounts(Array.isArray(accountsRes.data) ? accountsRes.data : []);
            setTransactions(Array.isArray(txRes.data) ? txRes.data : []);
        } catch (err) {
            console.error("Petty cash fetch error:", err);
            toast.error("Failed to load petty cash data");
            setAccounts([]);
            setTransactions([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchReloadHistory = async () => {
        try {
            const res = await api.get('/petty-cash/reload/history');
            setReloadHistory(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setReloadHistory([]);
        }
    };

    const fetchAuditLogs = async (txId = null) => {
        try {
            const res = await api.get('/petty-cash/audit-logs', { params: { transactionId: txId } });
            setAuditLogs(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
            setAuditLogs([]);
        }
    };

    const handleSearchSubmit = (e) => {
        e.preventDefault();
        fetchAllData();
    };

    const formatLKR = (amt) => {
        const val = Number(amt) || 0;
        return `LKR ${val.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PENDING_APPROVAL':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"><Clock size={12} /> Pending Approval</span>;
            case 'APPROVED':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/15 text-blue-400 border border-blue-500/30"><CheckCircle2 size={12} /> Approved (Ready for Cash)</span>;
            case 'CASH_ISSUED':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-400 border border-indigo-500/30"><Wallet size={12} /> Cash Issued</span>;
            case 'RECEIPT_SUBMITTED':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-purple-500/15 text-purple-400 border border-purple-500/30 animate-pulse"><FileText size={12} /> Receipt Under Review</span>;
            case 'RETURNED_FOR_CHANGES':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-orange-500/15 text-orange-400 border border-orange-500/30"><RotateCcw size={12} /> Returned for Changes</span>;
            case 'RETURNED_FOR_CORRECTION':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-400 border border-rose-500/30"><AlertTriangle size={12} /> Receipt Correction Required</span>;
            case 'SETTLED':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><Check size={12} /> Settled & Closed</span>;
            case 'REJECTED':
                return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-500/10 text-rose-500 border border-rose-500/20"><XCircle size={12} /> Rejected</span>;
            default:
                return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-300">{status}</span>;
        }
    };

    // ==============================================================
    // HANDLERS FOR ACTIONS
    // ==============================================================

    // 1. Submit Request
    const handleCreateRequest = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.post('/petty-cash/requests', requestForm);
            toast.success(res.data.message || "Request submitted successfully!");
            setShowNewRequestModal(false);
            setRequestForm({
                businessId: '',
                category: 'OFFICE_SUPPLIES',
                requestedAmount: '',
                purpose: '',
                requiredDate: new Date().toISOString().split('T')[0],
                additionalNotes: ''
            });
            fetchAllData();
            // Automatically open generated Request E-Slip
            if (res.data.transaction) {
                openESlip(res.data.transaction, 'request');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to submit request");
        } finally {
            setSubmitting(false);
        }
    };

    // 2. Admin Manager Review
    const handleReviewSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.post(`/petty-cash/requests/${selectedTx.id}/review`, reviewForm);
            toast.success(res.data.message || "Review action processed!");
            setShowReviewModal(false);
            fetchAllData();
            if (reviewForm.action === 'APPROVE' && res.data.transaction) {
                openESlip(res.data.transaction, 'approval');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to submit review");
        } finally {
            setSubmitting(false);
        }
    };

    // 3. Issue Cash (Finance)
    const handleIssueCash = async () => {
        setSubmitting(true);
        try {
            const res = await api.post(`/petty-cash/requests/${selectedTx.id}/issue-cash`);
            toast.success(res.data.message || "Cash issued successfully!");
            setShowIssueCashModal(false);
            fetchAllData();
            if (res.data.transaction) {
                openESlip(res.data.transaction, 'issue');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to issue cash");
        } finally {
            setSubmitting(false);
        }
    };

    // 4. Confirm Cash Received (Manager)
    const handleConfirmCashReceived = async (tx) => {
        try {
            const res = await api.post(`/petty-cash/requests/${tx.id}/confirm-receipt`);
            toast.success(res.data.message || "Cash confirmed as received!");
            fetchAllData();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to confirm cash receipt");
        }
    };

    // 5. Submit Expense & Receipt (Manager)
    const handleReceiptSubmit = async (e) => {
        e.preventDefault();
        if (!receiptForm.receiptFile && !selectedTx.receiptAttachment) {
            toast.error("Receipt or invoice file is mandatory!");
            return;
        }
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('actualSpentAmount', receiptForm.actualSpentAmount);
            formData.append('receiptNo', receiptForm.receiptNo);
            formData.append('vendorName', receiptForm.vendorName);
            formData.append('expenseDate', receiptForm.expenseDate);
            formData.append('expenseDescription', receiptForm.expenseDescription);
            if (receiptForm.receiptFile) {
                formData.append('receipt', receiptForm.receiptFile);
            }

            const res = await api.post(`/petty-cash/requests/${selectedTx.id}/submit-expense`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(res.data.message || "Receipt submitted successfully!");
            setShowReceiptModal(false);
            fetchAllData();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to submit receipt");
        } finally {
            setSubmitting(false);
        }
    };

    // 6. Verify & Settle Receipt (Finance)
    const handleVerifySubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.post(`/petty-cash/requests/${selectedTx.id}/verify-receipt`, verifyForm);
            toast.success(res.data.message || "Receipt verified successfully!");
            setShowVerifyModal(false);
            fetchAllData();
            if (verifyForm.decision === 'VERIFY_AND_SETTLE' && res.data.transaction) {
                openESlip(res.data.transaction, 'settlement');
            }
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to process verification");
        } finally {
            setSubmitting(false);
        }
    };

    // 7. Reload Petty Cash Fund (Finance)
    const handleReloadSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const res = await api.post('/petty-cash/reload', {
                businessId: selectedAccount.businessId,
                amount: reloadForm.amount,
                notes: reloadForm.notes,
                forceOverride: reloadForm.forceOverride
            });
            toast.success(res.data.message || "Fund reloaded successfully!");
            setShowReloadModal(false);
            setReloadForm({ amount: '', notes: '', forceOverride: false });
            fetchAllData();
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to reload fund");
        } finally {
            setSubmitting(false);
        }
    };

    // Open Unified E-Slip Modal
    const openESlip = (tx, tab = 'request') => {
        setSelectedTx(tx);
        setESlipActiveTab(tab);
        setShowESlipModal(true);
    };

    // Open Audit Trail Modal
    const openAuditTrail = async (tx) => {
        setSelectedTx(tx);
        await fetchAuditLogs(tx.id);
        setShowAuditModal(true);
    };

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
            
            {/* Top Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                <div className="absolute -right-20 -top-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute right-40 -bottom-20 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-gradient-to-br from-amber-500/20 to-emerald-500/20 border border-amber-500/30 rounded-2xl text-amber-400 shadow-inner">
                                <Wallet size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                                    Petty Cash Management
                                    <span className="text-[10px] uppercase font-black px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                                        E-Slip Verified
                                    </span>
                                </h1>
                                <p className="text-xs sm:text-sm font-semibold text-slate-400 mt-0.5">
                                    Enterprise Multi-Branch Float Control • Digital E-Slips • Immutable Audit Trail
                                </p>
                            </div>
                        </div>

                        {/* Active Role Indicator */}
                        <div className="flex flex-wrap items-center gap-2 mt-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logged In As:</span>
                            {isAdminManager && (
                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1.5 shadow-xs">
                                    <ShieldAlert size={12} /> Admin Manager (Approver)
                                </span>
                            )}
                            {isFinance && (
                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5 shadow-xs">
                                    <Wallet size={12} /> Finance Officer (Disburser & Verifier)
                                </span>
                            )}
                            {isBranchManager && (
                                <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-xs">
                                    <Building2 size={12} /> Branch Requester
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Primary Action Button */}
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => {
                                setRequestForm({
                                    businessId: accounts[0]?.businessId || '',
                                    category: 'OFFICE_SUPPLIES',
                                    requestedAmount: '',
                                    purpose: '',
                                    requiredDate: new Date().toISOString().split('T')[0],
                                    additionalNotes: ''
                                });
                                setShowNewRequestModal(true);
                            }}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm px-5 py-3 rounded-2xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
                        >
                            <Plus size={18} />
                            <span>New Petty Cash Request</span>
                        </button>
                    </div>
                </div>

                {/* KPI Metrics Strip */}
                {stats && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-800/80">
                        <div className="bg-slate-950/60 border border-slate-800 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Balance</span>
                            <span className="text-lg font-black text-emerald-400 mt-1 block">{formatLKR(stats.totalFundBalance)}</span>
                            <span className="text-[10px] text-slate-500">{accounts.length} Business Accounts</span>
                        </div>
                        <div className="bg-slate-950/60 border border-amber-500/20 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Pending Approval</span>
                            <span className="text-lg font-black text-amber-300 mt-1 block">{stats.pendingApprovalCount}</span>
                            <span className="text-[10px] text-amber-400/80">Needs Admin Review</span>
                        </div>
                        <div className="bg-slate-950/60 border border-blue-500/20 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block">Ready for Cash</span>
                            <span className="text-lg font-black text-blue-300 mt-1 block">{stats.approvedCount}</span>
                            <span className="text-[10px] text-blue-400/80">Approved Requests</span>
                        </div>
                        <div className="bg-slate-950/60 border border-indigo-500/20 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block">Cash Issued</span>
                            <span className="text-lg font-black text-indigo-300 mt-1 block">{stats.cashIssuedCount}</span>
                            <span className="text-[10px] text-indigo-400/80">Awaiting Receipts</span>
                        </div>
                        <div className="bg-slate-950/60 border border-purple-500/20 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block">Verify Receipts</span>
                            <span className="text-lg font-black text-purple-300 mt-1 block">{stats.receiptSubmittedCount}</span>
                            <span className="text-[10px] text-purple-400/80">Under Verification</span>
                        </div>
                        <div className="bg-slate-950/60 border border-emerald-500/20 p-3.5 rounded-2xl">
                            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block">Settled Total</span>
                            <span className="text-lg font-black text-emerald-300 mt-1 block">{stats.settledCount}</span>
                            <span className="text-[10px] text-emerald-400/80">Transactions Closed</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('workflow')}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        activeTab === 'workflow'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                    }`}
                >
                    <FileText size={16} />
                    <span>Active Workflow & Transactions</span>
                    {transactions.length > 0 && (
                        <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px] ml-1">
                            {transactions.length}
                        </span>
                    )}
                </button>

                {(isFinance || isAdminManager || isSystemAdmin) && (
                    <button
                        type="button"
                        onClick={() => {
                            setActiveTab('accounts');
                            fetchReloadHistory();
                        }}
                        className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                            activeTab === 'accounts'
                                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                                : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                        }`}
                    >
                        <Building2 size={16} />
                        <span>Business Funds & Reloads</span>
                        {stats?.lowBalanceAccountsCount > 0 && (
                            <span className="bg-rose-500/30 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full text-[10px] ml-1">
                                {stats.lowBalanceAccountsCount} Low
                            </span>
                        )}
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => {
                        setActiveTab('audit');
                        fetchAuditLogs();
                    }}
                    className={`px-5 py-2.5 rounded-2xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                        activeTab === 'audit'
                            ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                    }`}
                >
                    <History size={16} />
                    <span>System Audit Trail</span>
                </button>
            </div>

            {/* TAB 1: WORKFLOW & TRANSACTIONS */}
            {activeTab === 'workflow' && (
                <div className="space-y-4">
                    {/* Filters Strip */}
                    <div className="bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 backdrop-blur-md">
                        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-72">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search Slip #, ID, Purpose..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-500"
                            />
                        </form>

                        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                            {/* Business Filter */}
                            <select
                                value={businessFilter}
                                onChange={(e) => setBusinessFilter(e.target.value)}
                                className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-emerald-500"
                            >
                                <option value="ALL">All Businesses</option>
                                {(accounts || []).map(acc => (
                                    <option key={acc.businessId} value={acc.businessId}>
                                        {acc.business?.name || `Business #${acc.businessId}`}
                                    </option>
                                ))}
                            </select>

                            {/* Status Filter */}
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-emerald-500"
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING_APPROVAL">Pending Approval</option>
                                <option value="APPROVED">Approved (Need Cash)</option>
                                <option value="CASH_ISSUED">Cash Issued (Need Receipt)</option>
                                <option value="RECEIPT_SUBMITTED">Receipt Submitted (Need Verification)</option>
                                <option value="RETURNED_FOR_CHANGES">Returned for Changes</option>
                                <option value="RETURNED_FOR_CORRECTION">Receipt Correction Required</option>
                                <option value="SETTLED">Settled & Closed</option>
                                <option value="REJECTED">Rejected</option>
                            </select>

                            {/* Category Filter */}
                            <select
                                value={categoryFilter}
                                onChange={(e) => setCategoryFilter(e.target.value)}
                                className="bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-emerald-500"
                            >
                                <option value="ALL">All Categories</option>
                                {CATEGORIES.map(c => (
                                    <option key={c.id} value={c.id}>{c.label}</option>
                                ))}
                            </select>

                            <button
                                type="button"
                                onClick={fetchAllData}
                                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                                title="Refresh Table"
                            >
                                <RefreshCw size={15} />
                            </button>
                        </div>
                    </div>

                    {/* Transactions Table */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                                        <th className="p-4">Transaction / Slip #</th>
                                        <th className="p-4">Business</th>
                                        <th className="p-4">Requester</th>
                                        <th className="p-4">Expense Purpose</th>
                                        <th className="p-4 text-right">Requested</th>
                                        <th className="p-4 text-right">Approved</th>
                                        <th className="p-4 text-right">Spent / Returned</th>
                                        <th className="p-4 text-center">Status</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {(!transactions || transactions.length === 0) ? (
                                        <tr>
                                            <td colSpan={9} className="p-12 text-center text-slate-500 font-bold">
                                                No petty cash transactions found matching selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        (transactions || []).map((tx) => {
                                            const cat = CATEGORIES.find(c => c.id === tx.category);
                                            return (
                                                <tr key={tx.id} className="hover:bg-slate-800/30 transition-colors">
                                                    <td className="p-4 font-mono font-bold">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-white font-black">{tx.transactionNo}</span>
                                                            <span className="text-[10px] text-slate-400">{tx.requestSlipNo || '-'}</span>
                                                            <span className="text-[9px] text-slate-500">
                                                                {new Date(tx.requestedAt).toLocaleDateString()}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 font-bold text-slate-200">
                                                        <div className="flex items-center gap-2">
                                                            <Building2 size={14} className="text-emerald-400 shrink-0" />
                                                            <span className="truncate max-w-[140px]">{tx.business?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-slate-200">{tx.requester?.firstName} {tx.requester?.lastName}</span>
                                                            <span className="text-[10px] text-slate-500">{tx.requester?.role}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 max-w-[220px]">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 w-fit">
                                                                {cat?.label || tx.category}
                                                            </span>
                                                            <span className="font-medium text-slate-300 line-clamp-2 leading-relaxed" title={tx.purpose}>
                                                                {tx.purpose}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-right font-black text-amber-400">
                                                        {formatLKR(tx.requestedAmount)}
                                                    </td>
                                                    <td className="p-4 text-right font-black text-blue-400">
                                                        {tx.approvedAmount ? formatLKR(tx.approvedAmount) : '-'}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {tx.actualSpentAmount ? (
                                                            <div className="flex flex-col items-end">
                                                                <span className="font-black text-purple-300">{formatLKR(tx.actualSpentAmount)}</span>
                                                                {tx.cashReturnedAmount > 0 && (
                                                                    <span className="text-[10px] font-bold text-emerald-400">
                                                                        Ret: {formatLKR(tx.cashReturnedAmount)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600 font-bold">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        {getStatusBadge(tx.status)}
                                                    </td>
                                                    <td className="p-4 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            {/* Contextual Action Button */}
                                                            {isAdminManager && tx.status === 'PENDING_APPROVAL' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedTx(tx);
                                                                        setReviewForm({
                                                                            action: 'APPROVE',
                                                                            approvedAmount: tx.requestedAmount,
                                                                            approvalComments: '',
                                                                            rejectionReason: '',
                                                                            returnForChangesNote: ''
                                                                        });
                                                                        setShowReviewModal(true);
                                                                    }}
                                                                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
                                                                >
                                                                    Review
                                                                </button>
                                                            )}

                                                            {isFinance && tx.status === 'APPROVED' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedTx(tx);
                                                                        setShowIssueCashModal(true);
                                                                    }}
                                                                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
                                                                >
                                                                    Issue Cash
                                                                </button>
                                                            )}

                                                            {tx.status === 'CASH_ISSUED' && !tx.cashReceivedConfirmed && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleConfirmCashReceived(tx)}
                                                                    className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-bold text-xs transition-all cursor-pointer"
                                                                    title="Confirm you have physically received this cash"
                                                                >
                                                                    Confirm Cash
                                                                </button>
                                                            )}

                                                            {(tx.status === 'CASH_ISSUED' || tx.status === 'RETURNED_FOR_CORRECTION') && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedTx(tx);
                                                                        setReceiptForm({
                                                                            actualSpentAmount: tx.actualSpentAmount || tx.cashIssuedAmount || '',
                                                                            receiptNo: tx.receiptNo || '',
                                                                            vendorName: tx.vendorName || '',
                                                                            expenseDate: new Date().toISOString().split('T')[0],
                                                                            expenseDescription: tx.expenseDescription || '',
                                                                            receiptFile: null
                                                                        });
                                                                        setShowReceiptModal(true);
                                                                    }}
                                                                    className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                                                                >
                                                                    Upload Receipt
                                                                </button>
                                                            )}

                                                            {isFinance && tx.status === 'RECEIPT_SUBMITTED' && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        setSelectedTx(tx);
                                                                        setVerifyForm({
                                                                            decision: 'VERIFY_AND_SETTLE',
                                                                            verificationComments: '',
                                                                            returnCorrectionNote: ''
                                                                        });
                                                                        setShowVerifyModal(true);
                                                                    }}
                                                                    className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 active:scale-95 transition-all cursor-pointer"
                                                                >
                                                                    Verify & Settle
                                                                </button>
                                                            )}

                                                            {/* View E-Slip Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => openESlip(tx, 'request')}
                                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                                                                title="View All E-Slips"
                                                            >
                                                                <FileText size={15} />
                                                            </button>

                                                            {/* Audit Trail Button */}
                                                            <button
                                                                type="button"
                                                                onClick={() => openAuditTrail(tx)}
                                                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
                                                                title="View Audit Trail"
                                                            >
                                                                <History size={15} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: BUSINESS FUNDS & RELOAD HUB */}
            {activeTab === 'accounts' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {(accounts || []).map(acc => {
                            const percent = Math.min(100, Math.round((acc.currentBalance / acc.fundLimit) * 100));
                            const isLow = acc.currentBalance <= acc.minBalanceThreshold;
                            return (
                                <div key={acc.id} className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 shadow-xl relative overflow-hidden flex flex-col justify-between">
                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center font-black text-emerald-400">
                                                    {acc.business.logo ? (
                                                        <img src={acc.business.logo} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
                                                    ) : (
                                                        <Building2 size={20} />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-sm text-white">{acc.business.name}</h3>
                                                    <span className="text-[10px] font-bold text-slate-400">Petty Cash Float Account</span>
                                                </div>
                                            </div>

                                            {isLow ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                                    Low Balance
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                    Healthy
                                                </span>
                                            )}
                                        </div>

                                        {/* Balances Display */}
                                        <div className="mt-5 space-y-1">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Available Cash Balance</span>
                                            <div className="flex items-baseline justify-between">
                                                <span className={`text-2xl font-black ${isLow ? 'text-rose-400' : 'text-emerald-300'}`}>
                                                    {formatLKR(acc.currentBalance)}
                                                </span>
                                                <span className="text-xs font-bold text-slate-400">Limit: {formatLKR(acc.fundLimit)}</span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-slate-950 rounded-full mt-3 overflow-hidden border border-slate-800">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-gradient-to-r from-rose-500 to-amber-500' : 'bg-gradient-to-r from-teal-500 to-emerald-400'}`}
                                                style={{ width: `${percent}%` }}
                                            ></div>
                                        </div>

                                        {/* Reload Eligibility Status */}
                                        <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-[11px] space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400">Unsettled Cash Transactions:</span>
                                                <span className={`font-black ${acc.unsettledCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                    {acc.unsettledCount} Active
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-400">Reload Status:</span>
                                                {acc.reloadEligible ? (
                                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                        <CheckCircle2 size={12} /> Eligible to Reload
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-400 font-bold flex items-center gap-1">
                                                        <AlertTriangle size={12} /> Pending Settle
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Reload Button */}
                                    <div className="mt-5 pt-4 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedAccount(acc);
                                                setReloadForm({
                                                    amount: Math.max(10000, acc.fundLimit - acc.currentBalance),
                                                    notes: '',
                                                    forceOverride: false
                                                });
                                                setShowReloadModal(true);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs py-2.5 rounded-xl shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                                        >
                                            <RefreshCw size={14} />
                                            <span>Initiate Petty Cash Reload</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Reload History Table */}
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 shadow-xl backdrop-blur-md">
                        <h3 className="font-black text-sm text-white mb-4 flex items-center gap-2">
                            <History size={16} className="text-emerald-400" />
                            <span>Recent Petty Cash Reload History</span>
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                                        <th className="p-3">Reload Ref #</th>
                                        <th className="p-3">Business</th>
                                        <th className="p-3 text-right">Reload Amount</th>
                                        <th className="p-3 text-right">Previous Balance</th>
                                        <th className="p-3 text-right">New Balance</th>
                                        <th className="p-3">Authorized By</th>
                                        <th className="p-3">Date</th>
                                        <th className="p-3">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {(!reloadHistory || reloadHistory.length === 0) ? (
                                        <tr>
                                            <td colSpan={8} className="p-6 text-center text-slate-500 font-bold">
                                                No reload history records found.
                                            </td>
                                        </tr>
                                    ) : (
                                        (reloadHistory || []).map(r => (
                                            <tr key={r.id} className="hover:bg-slate-800/30">
                                                <td className="p-3 font-mono font-bold text-white">{r.reloadNo}</td>
                                                <td className="p-3 font-bold text-slate-200">{r.business?.name}</td>
                                                <td className="p-3 text-right font-black text-emerald-400">{formatLKR(r.amount)}</td>
                                                <td className="p-3 text-right text-slate-400">{formatLKR(r.previousBalance)}</td>
                                                <td className="p-3 text-right font-bold text-white">{formatLKR(r.newBalance)}</td>
                                                <td className="p-3 text-slate-300">{r.performedBy?.firstName} {r.performedBy?.lastName}</td>
                                                <td className="p-3 text-slate-400">{new Date(r.createdAt).toLocaleString()}</td>
                                                <td className="p-3 text-slate-400 max-w-[200px] truncate">{r.notes || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 3: SYSTEM AUDIT TRAIL */}
            {activeTab === 'audit' && (
                <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 shadow-xl backdrop-blur-md space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-black text-base text-white flex items-center gap-2">
                                <History size={18} className="text-emerald-400" />
                                <span>Petty Cash Audit Trail & Event Logs</span>
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">Immutable financial event history recorded automatically across all transactions.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => fetchAuditLogs()}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                        >
                            <RefreshCw size={13} /> Refresh Logs
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                                    <th className="p-3.5">Timestamp</th>
                                    <th className="p-3.5">Action</th>
                                    <th className="p-3.5">User</th>
                                    <th className="p-3.5">Transaction</th>
                                    <th className="p-3.5">Status Flow</th>
                                    <th className="p-3.5">Details & Comments</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {(!auditLogs || auditLogs.length === 0) ? (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-500 font-bold">
                                            No audit trail records loaded.
                                        </td>
                                    </tr>
                                ) : (
                                    (auditLogs || []).map(log => (
                                        <tr key={log.id} className="hover:bg-slate-800/20">
                                            <td className="p-3.5 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </td>
                                            <td className="p-3.5">
                                                <span className="font-black px-2 py-0.5 rounded text-[10px] bg-slate-800 text-emerald-400 border border-slate-700">
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-3.5">
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-slate-200">{log.userName}</span>
                                                    <span className="text-[10px] text-slate-500">{log.userRole}</span>
                                                </div>
                                            </td>
                                            <td className="p-3.5 font-mono text-white font-bold">
                                                {log.transaction?.transactionNo || '-'}
                                            </td>
                                            <td className="p-3.5">
                                                {log.previousStatus || log.newStatus ? (
                                                    <span className="text-[10px] font-semibold text-slate-400">
                                                        {log.previousStatus || 'NONE'} → <strong className="text-white">{log.newStatus}</strong>
                                                    </span>
                                                ) : '-'}
                                            </td>
                                            <td className="p-3.5 text-slate-300 max-w-[320px] leading-relaxed">
                                                {log.comments}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 1: NEW PETTY CASH REQUEST (MANAGER) */}
            {/* ========================================================= */}
            {showNewRequestModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowNewRequestModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                                <Plus size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">New Petty Cash Request</h3>
                                <p className="text-xs text-slate-400">Submit a new expense request for Admin Manager approval</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreateRequest} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Target Business Branch *
                                </label>
                                <select
                                    required
                                    value={requestForm.businessId}
                                    onChange={(e) => setRequestForm({ ...requestForm, businessId: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                                >
                                    <option value="" disabled>Select Business...</option>
                                    {(accounts || []).map(acc => (
                                        <option key={acc.businessId} value={acc.businessId}>
                                            {acc.business?.name || `Business #${acc.businessId}`} (Balance: {formatLKR(acc.currentBalance)})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Expense Category *
                                    </label>
                                    <select
                                        required
                                        value={requestForm.category}
                                        onChange={(e) => setRequestForm({ ...requestForm, category: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                                    >
                                        {CATEGORIES.map(c => (
                                            <option key={c.id} value={c.id}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Requested Amount (LKR) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="1"
                                        required
                                        placeholder="e.g. 5000.00"
                                        value={requestForm.requestedAmount}
                                        onChange={(e) => setRequestForm({ ...requestForm, requestedAmount: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-600"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Purpose / Detailed Description *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Explain why this petty cash is required, items to buy, or operational necessity..."
                                    value={requestForm.purpose}
                                    onChange={(e) => setRequestForm({ ...requestForm, purpose: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-emerald-500 placeholder:text-slate-600 resize-none leading-relaxed"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Required Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={requestForm.requiredDate}
                                        onChange={(e) => setRequestForm({ ...requestForm, requiredDate: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                        Additional Notes (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Optional references or notes"
                                        value={requestForm.additionalNotes}
                                        onChange={(e) => setRequestForm({ ...requestForm, additionalNotes: e.target.value })}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-emerald-500 placeholder:text-slate-600"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowNewRequestModal(false)}
                                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? 'Generating Request E-Slip...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 2: ADMIN MANAGER REVIEW (APPROVE / REJECT / RETURN) */}
            {/* ========================================================= */}
            {showReviewModal && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowReviewModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                                <ShieldAlert size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Admin Manager Request Review</h3>
                                <p className="text-xs text-slate-400">Review, adjust approved amount, and decide on this expense request</p>
                            </div>
                        </div>

                        {/* Request Summary Card */}
                        <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-5 space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Transaction No:</span>
                                <span className="font-mono font-bold text-white">{selectedTx.transactionNo}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Business:</span>
                                <span className="font-bold text-emerald-400">{selectedTx.business?.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Requester:</span>
                                <span className="font-bold text-slate-200">{selectedTx.requester?.firstName} {selectedTx.requester?.lastName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Requested Amount:</span>
                                <span className="font-black text-amber-400 text-sm">{formatLKR(selectedTx.requestedAmount)}</span>
                            </div>
                            <div className="pt-2 border-t border-slate-800/80">
                                <span className="text-slate-400 block mb-1">Purpose:</span>
                                <p className="text-slate-200 font-medium leading-relaxed bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                                    {selectedTx.purpose}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleReviewSubmit} className="space-y-4">
                            {/* Decision Radio Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                    Review Decision *
                                </label>
                                <div className="grid grid-cols-3 gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setReviewForm({ ...reviewForm, action: 'APPROVE' })}
                                        className={`p-3 rounded-2xl text-xs font-black border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                                            reviewForm.action === 'APPROVE'
                                                ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <CheckCircle2 size={18} />
                                        <span>Approve</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setReviewForm({ ...reviewForm, action: 'RETURN_FOR_CHANGES' })}
                                        className={`p-3 rounded-2xl text-xs font-black border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                                            reviewForm.action === 'RETURN_FOR_CHANGES'
                                                ? 'bg-orange-600/20 border-orange-500 text-orange-300 shadow-md shadow-orange-500/20'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <RotateCcw size={18} />
                                        <span>Return for Changes</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setReviewForm({ ...reviewForm, action: 'REJECT' })}
                                        className={`p-3 rounded-2xl text-xs font-black border transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                                            reviewForm.action === 'REJECT'
                                                ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-md shadow-rose-500/20'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        <XCircle size={18} />
                                        <span>Reject</span>
                                    </button>
                                </div>
                            </div>

                            {/* Conditional Inputs based on Decision */}
                            {reviewForm.action === 'APPROVE' && (
                                <div className="space-y-4 pt-2">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                            Approved Amount (LKR) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="1"
                                            required
                                            value={reviewForm.approvedAmount}
                                            onChange={(e) => setReviewForm({ ...reviewForm, approvedAmount: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-black text-emerald-400 outline-none focus:border-emerald-500"
                                        />
                                        <span className="text-[10px] text-slate-500 mt-1 block">
                                            You can keep the original requested amount ({formatLKR(selectedTx.requestedAmount)}) or adjust it.
                                        </span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                            Approval Comments (Optional)
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Approval remarks, limits, or specific vendor instructions..."
                                            value={reviewForm.approvalComments}
                                            onChange={(e) => setReviewForm({ ...reviewForm, approvalComments: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-emerald-500 resize-none"
                                        />
                                    </div>
                                </div>
                            )}

                            {reviewForm.action === 'RETURN_FOR_CHANGES' && (
                                <div className="pt-2">
                                    <label className="block text-xs font-bold text-orange-400 uppercase tracking-wider mb-1.5">
                                        Required Changes / Modification Instructions *
                                    </label>
                                    <textarea
                                        required
                                        rows={3}
                                        placeholder="Explain to the Manager what needs to be changed (e.g. reduce amount, attach quotes, clarify purpose)..."
                                        value={reviewForm.returnForChangesNote}
                                        onChange={(e) => setReviewForm({ ...reviewForm, returnForChangesNote: e.target.value })}
                                        className="w-full bg-slate-950 border border-orange-500/50 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-orange-500 resize-none leading-relaxed"
                                    />
                                </div>
                            )}

                            {reviewForm.action === 'REJECT' && (
                                <div className="pt-2">
                                    <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                                        Rejection Reason *
                                    </label>
                                    <textarea
                                        required
                                        rows={3}
                                        placeholder="State the formal reason for rejecting this petty cash request..."
                                        value={reviewForm.rejectionReason}
                                        onChange={(e) => setReviewForm({ ...reviewForm, rejectionReason: e.target.value })}
                                        className="w-full bg-slate-950 border border-rose-500/50 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-rose-500 resize-none leading-relaxed"
                                    />
                                </div>
                            )}

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowReviewModal(false)}
                                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                >
                                    {submitting ? 'Processing Decision...' : 'Confirm Decision'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 3: ISSUE CASH (PETTY CASH OFFICER - FINANCE) */}
            {/* ========================================================= */}
            {showIssueCashModal && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowIssueCashModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                                <Wallet size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Disburse Petty Cash</h3>
                                <p className="text-xs text-slate-400">Finance Cash Issue & Balance Verification</p>
                            </div>
                        </div>

                        {/* Balance Check Box */}
                        {(() => {
                            const acc = accounts.find(a => a.businessId === selectedTx.businessId);
                            const currentBalance = acc?.currentBalance || 0;
                            const amountToIssue = selectedTx.approvedAmount || selectedTx.requestedAmount;
                            const isSufficient = currentBalance >= amountToIssue;

                            return (
                                <div className="space-y-4">
                                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Business:</span>
                                            <span className="font-bold text-white">{selectedTx.business?.name}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Available Business Float:</span>
                                            <span className={`font-black text-sm ${isSufficient ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {formatLKR(currentBalance)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                                            <span className="text-slate-400 font-bold">Amount to Disburse:</span>
                                            <span className="font-black text-base text-blue-400">
                                                {formatLKR(amountToIssue)}
                                            </span>
                                        </div>
                                    </div>

                                    {!isSufficient ? (
                                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
                                            <AlertTriangle size={18} className="shrink-0 text-rose-400 mt-0.5" />
                                            <div>
                                                <strong className="block font-black">Insufficient Petty Cash Balance!</strong>
                                                <span>This business does not have enough petty cash float. Please reload the petty cash account before issuing funds.</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                                            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                            <span>Sufficient fund balance available. Ready to issue cash to <strong>{selectedTx.requester?.firstName} {selectedTx.requester?.lastName}</strong>.</span>
                                        </div>
                                    )}

                                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setShowIssueCashModal(false)}
                                            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            disabled={!isSufficient || submitting}
                                            onClick={handleIssueCash}
                                            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                                        >
                                            {submitting ? 'Generating Cash Issue Slip...' : 'Confirm & Issue Cash'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 4: MANDATORY RECEIPT & EXPENSE UPLOAD (MANAGER) */}
            {/* ========================================================= */}
            {showReceiptModal && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowReceiptModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                                <Upload size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Upload Expense Receipt</h3>
                                <p className="text-xs text-slate-400">Attach mandatory receipts and record actual expense</p>
                            </div>
                        </div>

                        {/* Cash Difference Visualizer */}
                        {(() => {
                            const issued = selectedTx.cashIssuedAmount || selectedTx.approvedAmount || 0;
                            const spent = parseFloat(receiptForm.actualSpentAmount) || 0;
                            const returned = Math.max(0, issued - spent);

                            return (
                                <form onSubmit={handleReceiptSubmit} className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cash Issued</span>
                                            <span className="font-black text-base text-blue-400 block mt-0.5">{formatLKR(issued)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Actual Spent</span>
                                            <span className="font-black text-base text-purple-400 block mt-0.5">{formatLKR(spent)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cash Returned</span>
                                            <span className={`font-black text-base block mt-0.5 ${returned > 0 ? 'text-emerald-400 font-black' : 'text-slate-500'}`}>
                                                {formatLKR(returned)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                                Actual Amount Spent (LKR) *
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                required
                                                placeholder="e.g. 4500.00"
                                                value={receiptForm.actualSpentAmount}
                                                onChange={(e) => setReceiptForm({ ...receiptForm, actualSpentAmount: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-black text-purple-300 outline-none focus:border-purple-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                                Expense Date *
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={receiptForm.expenseDate}
                                                onChange={(e) => setReceiptForm({ ...receiptForm, expenseDate: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                                Receipt / Bill Number
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. INV-9042"
                                                value={receiptForm.receiptNo}
                                                onChange={(e) => setReceiptForm({ ...receiptForm, receiptNo: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 placeholder:text-slate-600"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                                Vendor / Supplier Name
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Sarasavi Bookshop, Keells..."
                                                value={receiptForm.vendorName}
                                                onChange={(e) => setReceiptForm({ ...receiptForm, vendorName: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white outline-none focus:border-purple-500 placeholder:text-slate-600"
                                            />
                                        </div>
                                    </div>

                                    {/* MANDATORY RECEIPT UPLOAD */}
                                    <div>
                                        <label className="block text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Upload size={14} />
                                            <span>Upload Receipt / Invoice Document (Mandatory) *</span>
                                        </label>
                                        <div className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-2xl p-5 text-center bg-slate-950/60 transition-colors">
                                            <input
                                                type="file"
                                                id="receipt-file-input"
                                                accept=".jpg,.jpeg,.png,.webp,.pdf"
                                                onChange={(e) => setReceiptForm({ ...receiptForm, receiptFile: e.target.files[0] })}
                                                className="hidden"
                                            />
                                            <label htmlFor="receipt-file-input" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                                                <FileText size={32} className="text-slate-500" />
                                                <span className="text-xs font-bold text-slate-300">
                                                    {receiptForm.receiptFile ? receiptForm.receiptFile.name : 'Click to browse Receipt (JPG, PNG, PDF up to 12MB)'}
                                                </span>
                                                <span className="text-[10px] text-slate-500">Transaction cannot close without verifiable receipt</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                            Expense Notes
                                        </label>
                                        <textarea
                                            rows={2}
                                            placeholder="Optional notes or details on items purchased..."
                                            value={receiptForm.expenseDescription}
                                            onChange={(e) => setReceiptForm({ ...receiptForm, expenseDescription: e.target.value })}
                                            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-purple-500 resize-none"
                                        />
                                    </div>

                                    <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setShowReceiptModal(false)}
                                            className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {submitting ? 'Submitting Receipt...' : 'Submit Receipt for Verification'}
                                        </button>
                                    </div>
                                </form>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 5: RECEIPT VERIFICATION & FINAL SETTLEMENT (FINANCE) */}
            {/* ========================================================= */}
            {showVerifyModal && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-3xl rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowVerifyModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                                <CheckCircle2 size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Receipt Verification & Settlement</h3>
                                <p className="text-xs text-slate-400">Verify submitted receipt, reconcile returned cash, and close transaction</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Financial Reconciliation */}
                            <div className="space-y-4">
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Cash Issued:</span>
                                        <span className="font-mono font-bold text-blue-400 text-sm">
                                            {formatLKR(selectedTx.cashIssuedAmount)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Actual Amount Spent:</span>
                                        <span className="font-mono font-black text-purple-400 text-sm">
                                            {formatLKR(selectedTx.actualSpentAmount)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                                        <span className="text-slate-400 font-bold">Cash Returned to Fund:</span>
                                        <span className="font-mono font-black text-emerald-400 text-base">
                                            {formatLKR(selectedTx.cashReturnedAmount)}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                                    <div>
                                        <span className="text-slate-400 text-[10px] block">Receipt Number:</span>
                                        <span className="font-bold text-white">{selectedTx.receiptNo || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 text-[10px] block">Vendor / Supplier:</span>
                                        <span className="font-bold text-white">{selectedTx.vendorName || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 text-[10px] block">Expense Date:</span>
                                        <span className="font-bold text-white">
                                            {selectedTx.expenseDate ? new Date(selectedTx.expenseDate).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                </div>

                                <form onSubmit={handleVerifySubmit} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            Verification Action *
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setVerifyForm({ ...verifyForm, decision: 'VERIFY_AND_SETTLE' })}
                                                className={`p-3 rounded-2xl text-xs font-black border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                                                    verifyForm.decision === 'VERIFY_AND_SETTLE'
                                                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-500/20'
                                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                <CheckCircle2 size={16} />
                                                <span>Verify & Settle</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setVerifyForm({ ...verifyForm, decision: 'RETURN_FOR_CORRECTION' })}
                                                className={`p-3 rounded-2xl text-xs font-black border transition-all cursor-pointer flex flex-col items-center gap-1 ${
                                                    verifyForm.decision === 'RETURN_FOR_CORRECTION'
                                                        ? 'bg-rose-600/20 border-rose-500 text-rose-300 shadow-md shadow-rose-500/20'
                                                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                                }`}
                                            >
                                                <RotateCcw size={16} />
                                                <span>Return Correction</span>
                                            </button>
                                        </div>
                                    </div>

                                    {verifyForm.decision === 'RETURN_FOR_CORRECTION' ? (
                                        <div>
                                            <label className="block text-xs font-bold text-rose-400 uppercase tracking-wider mb-1.5">
                                                Correction Required Note *
                                            </label>
                                            <textarea
                                                required
                                                rows={2}
                                                placeholder="Explain why receipt is invalid (e.g. missing stamp, unreadable image, mismatch in amount)..."
                                                value={verifyForm.returnCorrectionNote}
                                                onChange={(e) => setVerifyForm({ ...verifyForm, returnCorrectionNote: e.target.value })}
                                                className="w-full bg-slate-950 border border-rose-500/50 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-rose-500 resize-none"
                                            />
                                        </div>
                                    ) : (
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                                Closing Remarks (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Verification comments or settlement notes"
                                                value={verifyForm.verificationComments}
                                                onChange={(e) => setVerifyForm({ ...verifyForm, verificationComments: e.target.value })}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500"
                                            />
                                        </div>
                                    )}

                                    <div className="pt-2 flex items-center justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowVerifyModal(false)}
                                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs shadow-lg shadow-purple-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                                        >
                                            {submitting ? 'Processing...' : 'Complete Settlement'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Right: Uploaded Receipt Preview */}
                            <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                                    Uploaded Receipt Document
                                </span>
                                <div className="flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-3 flex flex-col items-center justify-center min-h-[280px] overflow-hidden relative">
                                    {selectedTx.receiptAttachment ? (
                                        selectedTx.receiptAttachment.toLowerCase().endsWith('.pdf') ? (
                                            <div className="text-center p-6 space-y-3">
                                                <FileText size={48} className="text-purple-400 mx-auto" />
                                                <span className="font-bold text-white text-xs block">PDF Document Attached</span>
                                                <a
                                                    href={selectedTx.receiptAttachment}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
                                                >
                                                    <Download size={14} /> Open / Download PDF
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="relative group w-full h-full flex items-center justify-center">
                                                <img 
                                                    src={selectedTx.receiptAttachment} 
                                                    alt="Receipt Preview" 
                                                    className="max-h-[300px] w-auto object-contain rounded-xl shadow-md"
                                                />
                                                <a
                                                    href={selectedTx.receiptAttachment}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white font-bold text-xs gap-2 transition-opacity rounded-xl"
                                                >
                                                    <Eye size={18} /> View Full Image
                                                </a>
                                            </div>
                                        )
                                    ) : (
                                        <div className="text-slate-500 text-xs font-bold text-center">
                                            No receipt attachment found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 6: UNIFIED E-SLIP VIEWER (PRINTABLE & DOWNLOADABLE) */}
            {/* ========================================================= */}
            {showESlipModal && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowESlipModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        {/* E-Slip Navigation Tabs */}
                        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
                            <button
                                type="button"
                                onClick={() => setESlipActiveTab('request')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                    eSlipActiveTab === 'request'
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                1. Request E-Slip
                            </button>
                            <button
                                type="button"
                                onClick={() => setESlipActiveTab('approval')}
                                disabled={!selectedTx.approvalSlipNo}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-30 ${
                                    eSlipActiveTab === 'approval'
                                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                2. Approval E-Slip
                            </button>
                            <button
                                type="button"
                                onClick={() => setESlipActiveTab('issue')}
                                disabled={!selectedTx.cashIssueSlipNo}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-30 ${
                                    eSlipActiveTab === 'issue'
                                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                3. Cash Issue E-Slip
                            </button>
                            <button
                                type="button"
                                onClick={() => setESlipActiveTab('settlement')}
                                disabled={!selectedTx.finalSettlementSlipNo}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer disabled:opacity-30 ${
                                    eSlipActiveTab === 'settlement'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                4. Final Settlement E-Slip
                            </button>
                        </div>

                        {/* Printable E-Slip Content Container */}
                        <div id="printable-eslip-card" className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-inner border border-slate-200 font-sans">
                            {/* Corporate Header */}
                            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-4">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900 tracking-tight">IMA CAMPUS</h2>
                                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest block">
                                        Petty Cash Management System • Official Financial Record
                                    </span>
                                    <span className="text-xs font-bold text-emerald-700 mt-1 block">
                                        Branch: {selectedTx.business?.name}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-black text-slate-800 block">
                                        {eSlipActiveTab === 'request' && 'REQUEST E-SLIP'}
                                        {eSlipActiveTab === 'approval' && 'APPROVAL E-SLIP'}
                                        {eSlipActiveTab === 'issue' && 'CASH ISSUE E-SLIP'}
                                        {eSlipActiveTab === 'settlement' && 'FINAL SETTLEMENT E-SLIP'}
                                    </span>
                                    <span className="text-xs font-mono font-bold text-indigo-700 block">
                                        {eSlipActiveTab === 'request' && (selectedTx.requestSlipNo || selectedTx.transactionNo)}
                                        {eSlipActiveTab === 'approval' && (selectedTx.approvalSlipNo || selectedTx.transactionNo)}
                                        {eSlipActiveTab === 'issue' && (selectedTx.cashIssueSlipNo || selectedTx.transactionNo)}
                                        {eSlipActiveTab === 'settlement' && (selectedTx.finalSettlementSlipNo || selectedTx.transactionNo)}
                                    </span>
                                    <span className="text-[10px] text-slate-500 block">
                                        TX ID: {selectedTx.transactionNo}
                                    </span>
                                </div>
                            </div>

                            {/* E-Slip Body By Tab */}
                            {eSlipActiveTab === 'request' && (
                                <div className="space-y-4 text-xs">
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Requester:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.requester?.firstName} {selectedTx.requester?.lastName}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Request Date:</span>
                                            <span className="font-bold text-slate-900">{new Date(selectedTx.requestedAt).toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Expense Category:</span>
                                            <span className="font-bold text-slate-900">{CATEGORIES.find(c => c.id === selectedTx.category)?.label || selectedTx.category}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Required By Date:</span>
                                            <span className="font-bold text-slate-900">{new Date(selectedTx.requiredDate).toLocaleDateString()}</span>
                                        </div>
                                    </div>

                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 flex justify-between items-center">
                                        <span className="font-bold text-amber-900 uppercase">Requested Amount:</span>
                                        <span className="text-xl font-black text-amber-800">{formatLKR(selectedTx.requestedAmount)}</span>
                                    </div>

                                    <div>
                                        <span className="font-bold text-slate-700 block mb-1">Purpose / Description:</span>
                                        <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-medium">
                                            {selectedTx.purpose}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {eSlipActiveTab === 'approval' && (
                                <div className="space-y-4 text-xs">
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Approved By:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.adminManager?.firstName} {selectedTx.adminManager?.lastName} (Admin Manager)</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Approval Date:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.approvedAt ? new Date(selectedTx.approvedAt).toLocaleString() : '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Requested Amount:</span>
                                            <span className="font-bold text-slate-600">{formatLKR(selectedTx.requestedAmount)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Approval Status:</span>
                                            <span className="font-black text-emerald-700 uppercase">APPROVED</span>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 flex justify-between items-center">
                                        <span className="font-bold text-blue-900 uppercase">Approved Amount:</span>
                                        <span className="text-xl font-black text-blue-800">{formatLKR(selectedTx.approvedAmount)}</span>
                                    </div>

                                    <div>
                                        <span className="font-bold text-slate-700 block mb-1">Approval Comments:</span>
                                        <p className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-800 leading-relaxed font-medium">
                                            {selectedTx.approvalComments || 'Approved as requested.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {eSlipActiveTab === 'issue' && (
                                <div className="space-y-4 text-xs">
                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Cash Issued By:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.issuedByOfficer?.firstName} {selectedTx.issuedByOfficer?.lastName} (Finance Officer)</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Issue Date:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.cashIssuedAt ? new Date(selectedTx.cashIssuedAt).toLocaleString() : '-'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Received By:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.requester?.firstName} {selectedTx.requester?.lastName}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Manager Confirmation:</span>
                                            <span className={`font-black ${selectedTx.cashReceivedConfirmed ? 'text-emerald-700' : 'text-amber-700'}`}>
                                                {selectedTx.cashReceivedConfirmed ? 'CONFIRMED' : 'PENDING CONFIRMATION'}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 flex justify-between items-center">
                                        <span className="font-bold text-indigo-900 uppercase">Cash Amount Issued:</span>
                                        <span className="text-xl font-black text-indigo-800">{formatLKR(selectedTx.cashIssuedAmount)}</span>
                                    </div>
                                </div>
                            )}

                            {eSlipActiveTab === 'settlement' && (
                                <div className="space-y-4 text-xs">
                                    <div className="grid grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                                        <div>
                                            <span className="text-slate-500 text-[10px] block uppercase font-bold">Cash Issued</span>
                                            <span className="font-black text-blue-700 text-sm">{formatLKR(selectedTx.cashIssuedAmount)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 text-[10px] block uppercase font-bold">Actual Spent</span>
                                            <span className="font-black text-purple-700 text-sm">{formatLKR(selectedTx.actualSpentAmount)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 text-[10px] block uppercase font-bold">Cash Returned</span>
                                            <span className="font-black text-emerald-700 text-sm">{formatLKR(selectedTx.cashReturnedAmount)}</span>
                                        </div>
                                    </div>

                                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex justify-between items-center">
                                        <span className="font-bold text-emerald-900 uppercase">Final Net Settlement:</span>
                                        <span className="text-xl font-black text-emerald-800">{formatLKR(selectedTx.actualSpentAmount)}</span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Receipt Ref #:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.receiptNo || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Vendor / Supplier:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.vendorName || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Verified By:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.verifiedByOfficer?.firstName} {selectedTx.verifiedByOfficer?.lastName}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 font-semibold block">Settlement Date:</span>
                                            <span className="font-bold text-slate-900">{selectedTx.settledAt ? new Date(selectedTx.settledAt).toLocaleString() : '-'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Footer Signatures */}
                            <div className="mt-8 pt-6 border-t-2 border-slate-300 grid grid-cols-3 gap-4 text-center text-[10px] text-slate-500 font-semibold">
                                <div>
                                    <div className="w-24 h-px bg-slate-400 mx-auto mb-1"></div>
                                    <span>Requester (Manager)</span>
                                </div>
                                <div>
                                    <div className="w-24 h-px bg-slate-400 mx-auto mb-1"></div>
                                    <span>Admin Manager</span>
                                </div>
                                <div>
                                    <div className="w-24 h-px bg-slate-400 mx-auto mb-1"></div>
                                    <span>Finance Officer</span>
                                </div>
                            </div>
                        </div>

                        {/* Print Button */}
                        <div className="mt-6 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                            >
                                <Printer size={15} />
                                <span>Print E-Slip</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 7: TRANSACTION AUDIT TRAIL MODAL */}
            {/* ========================================================= */}
            {showAuditModal && selectedTx && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowAuditModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-500/30">
                                <History size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Transaction Audit Trail</h3>
                                <p className="text-xs text-slate-400">Complete lifecycle log for {selectedTx.transactionNo}</p>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                            {(!auditLogs || auditLogs.length === 0) ? (
                                <p className="text-xs text-slate-500 text-center py-6">No audit records found for this transaction.</p>
                            ) : (
                                (auditLogs || []).map((log, idx) => (
                                    <div key={log.id} className="relative pl-6 pb-4 border-l-2 border-slate-800 last:border-0 last:pb-0">
                                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-900 border-2 border-emerald-500 flex items-center justify-center">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                                        </div>
                                        <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800/80 text-xs space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-black text-emerald-400">{log.action}</span>
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                                <User size={12} />
                                                <span><strong>{log.userName}</strong> ({log.userRole})</span>
                                            </div>
                                            {log.comments && (
                                                <p className="text-slate-300 text-[11px] mt-1 pt-1 border-t border-slate-900 leading-relaxed">
                                                    {log.comments}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MODAL 8: RELOAD PETTY CASH FUND (FINANCE) */}
            {/* ========================================================= */}
            {showReloadModal && selectedAccount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl relative">
                        <button
                            type="button"
                            onClick={() => setShowReloadModal(false)}
                            className="absolute top-6 right-6 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
                        >
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                                <RefreshCw size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white">Reload Petty Cash Fund</h3>
                                <p className="text-xs text-slate-400">Replenish physical float for {selectedAccount.business.name}</p>
                            </div>
                        </div>

                        {/* Pre-Reload Check Alert */}
                        {!selectedAccount.reloadEligible && (
                            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs mb-5 flex items-start gap-3">
                                <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
                                <div>
                                    <strong className="block font-black text-amber-300">Unsettled Transactions Detected!</strong>
                                    <span>
                                        There are <strong>{selectedAccount.unsettledCount}</strong> active transaction(s) with cash issued or pending receipts.
                                        System policy mandates resolving pending receipts before reload.
                                    </span>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleReloadSubmit} className="space-y-4">
                            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Current Balance:</span>
                                    <span className="font-bold text-white">{formatLKR(selectedAccount.currentBalance)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400">Fund Limit:</span>
                                    <span className="font-bold text-slate-400">{formatLKR(selectedAccount.fundLimit)}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Reload Amount (LKR) *
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="1"
                                    required
                                    placeholder="e.g. 25000.00"
                                    value={reloadForm.amount}
                                    onChange={(e) => setReloadForm({ ...reloadForm, amount: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-xs font-black text-emerald-400 outline-none focus:border-emerald-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                                    Authorization Notes / Cheque or CDM Ref
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. Bank cheque #80234 issued to cash float..."
                                    value={reloadForm.notes}
                                    onChange={(e) => setReloadForm({ ...reloadForm, notes: e.target.value })}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-medium text-white outline-none focus:border-emerald-500 resize-none"
                                />
                            </div>

                            {!selectedAccount.reloadEligible && (
                                <label className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-amber-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={reloadForm.forceOverride}
                                        onChange={(e) => setReloadForm({ ...reloadForm, forceOverride: e.target.checked })}
                                        className="rounded text-emerald-500 focus:ring-0"
                                    />
                                    <span>Officer Override: Authorize reload despite unsettled receipts</span>
                                </label>
                            )}

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowReloadModal(false)}
                                    className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting || (!selectedAccount.reloadEligible && !reloadForm.forceOverride)}
                                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-40"
                                >
                                    {submitting ? 'Reloading...' : 'Confirm Reload'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}


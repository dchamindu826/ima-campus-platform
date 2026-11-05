import React, { useState, useEffect } from 'react';
import { physicalFinanceService } from '../../api/physicalFinance';
import physicalCrmService from '../../api/physicalCrm';
import { Wallet, TrendingUp, TrendingDown, Plus, Trash2, Calendar, Settings, Edit2, Check, X, Tag, Printer, RotateCcw, AlertTriangle, Archive, FileText, Search, Coins, UserCheck, DollarSign, GraduationCap, Bell, Clock, CalendarDays, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import ThermalReceiptModal from '../../components/PhysicalCRM/ThermalReceiptModal';
import DailyCashFlowPrintModal from '../../components/PhysicalCRM/DailyCashFlowPrintModal';
import { printThermalReceipt } from '../../utils/thermalReceiptPrinter';

const PRESET_DELETE_REASONS = [
    "Duplicate Entry",
    "Wrong Student / Class Selected",
    "Amount Error / Correction",
    "Payment Cancelled / Refunded",
    "Entered in Mistake"
];

export default function CashFlowPortal() {
    const [transactions, setTransactions] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [summary, setSummary] = useState({ 
        totalIncome: 0, 
        totalExpense: 0, 
        dayNet: 0, 
        openingBalance: 0, 
        isManualOpeningBalance: false, 
        manualOpeningBalanceRecord: null, 
        closingBalance: 0, 
        netCash: 0 
    });
    const [loading, setLoading] = useState(false);
    
    const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

    // Installment Reminders State
    const [reminders, setReminders] = useState([]);
    const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);

    // Opening Balance Modal State
    const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
    const [openingFormDate, setOpeningFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [openingAmount, setOpeningAmount] = useState('');
    const [openingNote, setOpeningNote] = useState('');
    const [openingLoading, setOpeningLoading] = useState(false);

    // Delete Reason Modal State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [txToDelete, setTxToDelete] = useState(null);
    const [deleteReason, setDeleteReason] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Trash Modal State
    const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
    const [trashList, setTrashList] = useState([]);
    const [trashLoading, setTrashLoading] = useState(false);
    const [trashCount, setTrashCount] = useState(0);

    // Receipt Modal State
    const [receiptModalOpen, setReceiptModalOpen] = useState(false);
    const [selectedReceiptData, setSelectedReceiptData] = useState(null);
    const [autoPrintDirect, setAutoPrintDirect] = useState(false);

    // A4 Daily Cash Flow Printable Sheet Modal
    const [isPrintSheetOpen, setIsPrintSheetOpen] = useState(false);
    
    // Categories State
    const [categories, setCategories] = useState([]);
    const [catLoading, setCatLoading] = useState(false);
    const [newCatName, setNewCatName] = useState('');
    const [newCatType, setNewCatType] = useState('EXPENSE');
    const [newCatIsLecturer, setNewCatIsLecturer] = useState(false);
    const [editingCatId, setEditingCatId] = useState(null);
    const [editingCatName, setEditingCatName] = useState('');
    const [editingCatIsLecturer, setEditingCatIsLecturer] = useState(false);

    // Teachers List for Lecturer Expenses
    const [teachers, setTeachers] = useState([]);
    const [lecturerSearchTerm, setLecturerSearchTerm] = useState('');
    const [isSelectingLecturer, setIsSelectingLecturer] = useState(false);

    const [formData, setFormData] = useState({
        type: 'INCOME',
        category: '',
        amount: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        teacherId: '',
        billingMonth: format(new Date(), 'yyyy-MM'),
        isTeacherAdvance: false,
        paymentMethod: 'CASH', // 'CASH' | 'BANK' | 'CHEQUE' | 'ONLINE' | 'OTHER'
        affectsCash: true, // true = Deducts/Adds from drawer cash, false = Bank/Non-cash
        isInstallment: false,
        installmentCount: 3,
        installments: []
    });

    useEffect(() => {
        fetchData();
        fetchCategories();
        fetchTrashData();
        fetchTeachers();
        fetchReminders();
    }, [selectedDate]);

    const fetchReminders = async () => {
        try {
            const data = await physicalFinanceService.getInstallmentReminders();
            setReminders(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load installment reminders', err);
        }
    };

    const fetchTeachers = async () => {
        try {
            const data = await physicalCrmService.getTeachers();
            setTeachers(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load teachers for cash flow', err);
        }
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await physicalFinanceService.getTransactions(selectedDate);
            setTransactions(data.transactions || []);
            setSummary(data.summary || { 
                totalIncome: 0, 
                totalExpense: 0, 
                dayNet: 0, 
                openingBalance: 0, 
                isManualOpeningBalance: false, 
                manualOpeningBalanceRecord: null, 
                closingBalance: 0, 
                netCash: 0 
            });
        } catch (err) {
            toast.error('Failed to load cash flow data');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenOpeningModal = () => {
        setOpeningFormDate(selectedDate);
        if (summary.isManualOpeningBalance && summary.manualOpeningBalanceRecord) {
            setOpeningAmount(summary.manualOpeningBalanceRecord.amount.toString());
            setOpeningNote(summary.manualOpeningBalanceRecord.note || '');
        } else {
            setOpeningAmount(summary.openingBalance !== undefined ? summary.openingBalance.toString() : '');
            setOpeningNote('');
        }
        setIsOpeningModalOpen(true);
    };

    const handleSaveOpeningBalance = async (e) => {
        e.preventDefault();
        if (openingAmount === '' || isNaN(parseFloat(openingAmount))) {
            toast.error('Please enter a valid amount');
            return;
        }
        setOpeningLoading(true);
        try {
            let cashier = 'Staff / Cashier';
            try {
                const u = JSON.parse(localStorage.getItem('user') || '{}');
                cashier = u.name || u.fullName || u.username || 'Staff';
            } catch(e) {}

            await physicalFinanceService.setOpeningBalance({
                date: openingFormDate,
                amount: parseFloat(openingAmount),
                note: openingNote.trim(),
                setBy: cashier
            });
            toast.success(`Opening balance saved for ${openingFormDate}!`);
            setIsOpeningModalOpen(false);
            if (openingFormDate !== selectedDate) {
                setSelectedDate(openingFormDate);
            } else {
                fetchData();
            }
        } catch (err) {
            toast.error('Failed to save opening balance: ' + (err.response?.data?.error || err.message));
        } finally {
            setOpeningLoading(false);
        }
    };

    const handleResetOpeningBalance = async () => {
        if (!window.confirm(`Reset manual opening balance for ${openingFormDate}? It will automatically carry forward the closing balance from previous days.`)) return;
        setOpeningLoading(true);
        try {
            await physicalFinanceService.deleteOpeningBalance(openingFormDate);
            toast.success(`Reverted ${openingFormDate} to automatic carryover balance.`);
            setIsOpeningModalOpen(false);
            fetchData();
        } catch (err) {
            toast.error('Failed to reset opening balance');
        } finally {
            setOpeningLoading(false);
        }
    };

    const fetchTrashData = async () => {
        setTrashLoading(true);
        try {
            const data = await physicalFinanceService.getTrash();
            setTrashList(data.trash || []);
            setTrashCount(data.count || (data.trash ? data.trash.length : 0));
        } catch (err) {
            console.error('Failed to fetch trash', err);
        } finally {
            setTrashLoading(false);
        }
    };

    const fetchCategories = async () => {
        setCatLoading(true);
        try {
            const data = await physicalFinanceService.getCategories();
            const safeCategories = Array.isArray(data) ? data : [];
            setCategories(safeCategories);
            
            // Set default category for form if empty
            if (safeCategories.length > 0 && !formData.category) {
                const defaultCat = safeCategories.find(c => c.type === formData.type);
                if (defaultCat) {
                    setFormData(prev => ({ ...prev, category: defaultCat.name }));
                }
            }
        } catch (err) {
            console.error('Failed to load categories', err);
            setCategories([]);
        } finally {
            setCatLoading(false);
        }
    };

    // Filter categories by form type
    const safeCategoriesList = Array.isArray(categories) ? categories : [];
    const activeTypeCategories = safeCategoriesList.filter(c => c.type === formData.type);

    const filteredTransactions = transactions.filter(tx => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const studentName = (tx.student?.studentName || `${tx.student?.firstName || ''} ${tx.student?.lastName || ''}`).toLowerCase();
        const studentId = (tx.student?.studentId || '').toLowerCase();
        const description = (tx.description || '').toLowerCase();
        const category = (tx.category || '').toLowerCase();
        const type = (tx.type || '').toLowerCase();
        const amount = (tx.amount || '').toString();

        return studentName.includes(q) ||
               studentId.includes(q) ||
               description.includes(q) ||
               category.includes(q) ||
               type.includes(q) ||
               amount.includes(q);
    });

    const handleTypeChange = (newType) => {
        const available = safeCategoriesList.filter(c => c.type === newType);
        const firstCat = available.length > 0 ? available[0] : null;
        const isLectCat = Boolean(firstCat?.isLecturerCategory);
        setFormData({
            ...formData,
            type: newType,
            category: firstCat ? firstCat.name : '',
            isTeacherAdvance: isLectCat,
            teacherId: isLectCat ? formData.teacherId : '',
            billingMonth: formData.billingMonth || (formData.date ? formData.date.slice(0, 7) : format(new Date(), 'yyyy-MM'))
        });
    };

    const handleCategoryChange = (catName) => {
        const chosenCat = categories.find(c => c.name === catName && c.type === formData.type);
        const isLectCat = Boolean(chosenCat?.isLecturerCategory || catName.toLowerCase().includes('advance') || catName.toLowerCase().includes('teacher'));
        setFormData(prev => ({
            ...prev,
            category: catName,
            isTeacherAdvance: isLectCat,
            billingMonth: prev.billingMonth || (prev.date ? prev.date.slice(0, 7) : format(new Date(), 'yyyy-MM'))
        }));
    };

    // Generate Installment Rows Helper
    const generateInstallmentRows = (count, totalAmount, startDate, method, affectsCashImpact) => {
        const num = Math.max(2, Math.min(12, parseInt(count) || 3));
        const total = parseFloat(totalAmount) || 0;
        const splitAmount = total > 0 ? Math.round((total / num) * 100) / 100 : 0;
        const baseDate = startDate ? new Date(startDate) : new Date();

        const rows = [];
        for (let i = 0; i < num; i++) {
            const d = new Date(baseDate);
            d.setMonth(d.getMonth() + i);
            const dateStr = format(d, 'yyyy-MM-dd');
            const amt = (i === num - 1 && total > 0) 
                ? Math.round((total - splitAmount * (num - 1)) * 100) / 100 
                : splitAmount;

            rows.push({
                installmentNo: i + 1,
                dueDate: dateStr,
                amount: amt > 0 ? String(amt) : '',
                paymentMethod: method || 'CASH',
                affectsCash: affectsCashImpact !== undefined ? affectsCashImpact : true,
                description: `Installment ${i + 1}/${num}`,
                isVerified: i === 0 && dateStr === format(new Date(), 'yyyy-MM-dd')
            });
        }
        return rows;
    };

    const handleToggleInstallment = (enabled) => {
        setFormData(prev => {
            const newCount = prev.installmentCount || 3;
            const newRows = enabled 
                ? generateInstallmentRows(newCount, prev.amount, prev.date, prev.paymentMethod, prev.affectsCash) 
                : [];
            return {
                ...prev,
                isInstallment: enabled,
                installmentCount: newCount,
                installments: newRows
            };
        });
    };

    const handleInstallmentCountChange = (count) => {
        const num = Math.max(2, Math.min(12, parseInt(count) || 3));
        setFormData(prev => ({
            ...prev,
            installmentCount: num,
            installments: generateInstallmentRows(num, prev.amount, prev.date, prev.paymentMethod, prev.affectsCash)
        }));
    };

    const handleInstallmentFieldChange = (index, field, value) => {
        setFormData(prev => {
            const updated = [...prev.installments];
            updated[index] = { ...updated[index], [field]: value };
            return { ...prev, installments: updated };
        });
    };

    const handleDistributeEvenly = () => {
        const rows = generateInstallmentRows(
            formData.installmentCount,
            formData.amount,
            formData.date,
            formData.paymentMethod,
            formData.affectsCash
        );
        setFormData(prev => ({ ...prev, installments: rows }));
        toast.success('Amounts distributed evenly across installments');
    };

    // Verify / Settle Transaction Handler
    const handleVerifyTransaction = async (id, currentVerifiedState) => {
        try {
            await physicalFinanceService.verifyTransaction(id, !currentVerifiedState);
            toast.success(!currentVerifiedState ? 'Transaction verified and settled into cash flow!' : 'Marked as pending verification');
            fetchData();
            fetchReminders();
        } catch (err) {
            toast.error('Failed to update verification status');
        }
    };

    const handleAddTransaction = async (e) => {
        e.preventDefault();
        if (!formData.category) {
            toast.error('Please select or add a category');
            return;
        }

        const selectedCatObj = categories.find(c => c.name === formData.category && c.type === formData.type);
        const isLectCat = Boolean(selectedCatObj?.isLecturerCategory || formData.isTeacherAdvance || formData.teacherId);

        if (isLectCat && !formData.teacherId) {
            toast.error('Please select the Lecturer to link this advance/expense to');
            return;
        }

        if (formData.isInstallment) {
            if (!formData.installments || formData.installments.length < 2) {
                toast.error('Please configure at least 2 installments');
                return;
            }
            const totalPlanned = parseFloat(formData.amount) || 0;
            const sumInstallments = formData.installments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
            if (totalPlanned > 0 && Math.abs(sumInstallments - totalPlanned) > 1) {
                toast.error(`Installments total (Rs. ${sumInstallments.toLocaleString()}) does not match Total Amount (Rs. ${totalPlanned.toLocaleString()})`);
                return;
            }
        } else {
            if (!formData.amount || parseFloat(formData.amount) <= 0) {
                toast.error('Please enter a valid amount');
                return;
            }
        }

        try {
            const txDate = formData.date || selectedDate;
            const payload = {
                ...formData,
                date: txDate,
                teacherId: formData.teacherId ? parseInt(formData.teacherId) : null,
                billingMonth: formData.teacherId ? (formData.billingMonth || txDate.slice(0, 7)) : null,
                isTeacherAdvance: isLectCat,
                paymentMethod: formData.paymentMethod || 'CASH',
                affectsCash: formData.affectsCash !== undefined ? Boolean(formData.affectsCash) : true,
                isInstallment: Boolean(formData.isInstallment),
                installments: formData.isInstallment ? formData.installments : undefined
            };

            const createdTx = await physicalFinanceService.addTransaction(payload);
            toast.success(formData.isInstallment ? 'Installment plan scheduled successfully!' : 'Transaction added successfully!');
            setIsAddModalOpen(false);

            const savedData = {
                ...(createdTx || {}),
                type: formData.type,
                category: formData.category,
                amount: formData.amount,
                description: formData.description,
                date: txDate,
                teacher: formData.teacherId ? teachers.find(t => t.id === parseInt(formData.teacherId)) : null,
                billingMonth: formData.billingMonth
            };

            const currentCat = formData.category;
            const currentType = formData.type;
            setFormData({ 
                type: currentType, 
                category: currentCat, 
                amount: '', 
                description: '', 
                date: selectedDate,
                teacherId: '',
                billingMonth: format(new Date(), 'yyyy-MM'),
                isTeacherAdvance: false,
                paymentMethod: 'CASH',
                affectsCash: true,
                isInstallment: false,
                installmentCount: 3,
                installments: []
            });
            
            if (txDate !== selectedDate) {
                setSelectedDate(txDate);
            } else {
                fetchData();
            }
            fetchReminders();

            if (!formData.isInstallment) {
                handlePrintReceipt(savedData);
            }
        } catch (err) {
            toast.error('Failed to add transaction: ' + (err.response?.data?.error || err.message));
        }
    };

    // Open Delete Reason Modal
    const handleInitiateDelete = (tx) => {
        setTxToDelete(tx);
        setDeleteReason('');
        setIsDeleteModalOpen(true);
    };

    // Confirm Delete with Reason
    const handleConfirmDelete = async (e) => {
        e.preventDefault();
        if (!txToDelete) return;
        if (!deleteReason.trim()) {
            toast.error('Please provide a reason for deleting this entry.');
            return;
        }

        setDeleteLoading(true);
        try {
            await physicalFinanceService.deleteTransaction(txToDelete.id, deleteReason.trim(), 'Staff / Manager');
            toast.success('Transaction moved to Trash with deletion reason.');
            setIsDeleteModalOpen(false);
            setTxToDelete(null);
            setDeleteReason('');
            fetchData();
            fetchTrashData();
        } catch (err) {
            toast.error('Failed to delete transaction: ' + (err.response?.data?.error || err.message));
        } finally {
            setDeleteLoading(false);
        }
    };

    // Restore from Trash
    const handleRestore = async (id) => {
        try {
            await physicalFinanceService.restoreTransaction(id);
            toast.success('Transaction restored back to active cash flow!');
            fetchData();
            fetchTrashData();
        } catch (err) {
            toast.error('Failed to restore transaction');
        }
    };

    // Toggle Real Cash vs Non-Cash Impact for any existing transaction
    const handleToggleTxCashImpact = async (t) => {
        const nextState = !t.affectsCash;
        const msg = nextState 
            ? `Change transaction "${t.category} - Rs. ${Number(t.amount).toLocaleString()}" to Real Cash In Hand (Will affect Drawer Balance)?` 
            : `Change transaction "${t.category} - Rs. ${Number(t.amount).toLocaleString()}" to Non-Cash / Bank (Drawer Balance unaffected)?`;
        if (!window.confirm(msg)) return;

        const loadToast = toast.loading('Updating Cash Drawer Impact...');
        try {
            await physicalFinanceService.toggleCashImpact(t.id);
            toast.success(`Updated: ${nextState ? '💵 Real Cash in Hand' : '🏦 Non-Cash (Bank)'}`, { id: loadToast });
            fetchData();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to update cash impact', { id: loadToast });
        }
    };

    // Print Receipt / Voucher for Income or Expense Transaction
    const handlePrintReceipt = (tx, shouldAutoPrint = true) => {
        let loggedUserCashier = 'Cashier / Staff';
        try {
            const userStr = localStorage.getItem('user');
            if (userStr) {
                const u = JSON.parse(userStr);
                const name = u.name || u.fullName || `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.username;
                if (name && name.trim()) loggedUserCashier = name.trim();
            }
        } catch (e) {}

        const isExpense = tx.type === 'EXPENSE';
        const txIdStr = tx.id ? String(tx.id) : Date.now().toString().slice(-6);
        const receiptNo = isExpense ? `EXP-${txIdStr}` : `REC-${txIdStr}`;
        const descText = tx.description 
            ? `${tx.category} - ${tx.description}` 
            : `${tx.category} ${isExpense ? 'Expense' : 'Payment'}`;

        const receiptObj = {
            isExpense,
            type: tx.type || (isExpense ? 'EXPENSE' : 'INCOME'),
            receiptNo,
            date: new Date(tx.date || tx.createdAt || Date.now()),
            studentId: tx.student?.studentId || '-',
            studentName: tx.student?.studentName || `${tx.student?.firstName || ''} ${tx.student?.lastName || ''}`.trim() || (isExpense ? null : 'Student'),
            className: descText,
            month: '',
            cardType: isExpense ? 'EXPENSE' : 'FULL',
            amount: tx.amount,
            paymentMethod: 'CASH',
            cashierName: loggedUserCashier,
            items: [
                {
                    description: descText,
                    amount: tx.amount
                }
            ],
            totalAmount: tx.amount
        };

        setAutoPrintDirect(Boolean(shouldAutoPrint));
        setSelectedReceiptData(receiptObj);
        setReceiptModalOpen(true);
    };

    // --- Category Management Handlers ---
    const handleAddCategory = async (e) => {
        e.preventDefault();
        if (!newCatName.trim()) {
            toast.error('Category name is required');
            return;
        }
        try {
            await physicalFinanceService.addCategory({ 
                name: newCatName.trim(), 
                type: newCatType,
                isLecturerCategory: newCatType === 'EXPENSE' ? Boolean(newCatIsLecturer) : false
            });
            toast.success(`Category "${newCatName}" added!`);
            setNewCatName('');
            setNewCatIsLecturer(false);
            fetchCategories();
        } catch (err) {
            toast.error('Failed to add category: ' + (err.response?.data?.error || err.message));
        }
    };

    const handleUpdateCategory = async (id) => {
        if (!editingCatName.trim()) {
            toast.error('Category name cannot be empty');
            return;
        }
        try {
            await physicalFinanceService.updateCategory(id, { 
                name: editingCatName.trim(),
                isLecturerCategory: editingCatIsLecturer
            });
            toast.success('Category updated!');
            setEditingCatId(null);
            fetchCategories();
            fetchData(); // In case historical transactions were updated
        } catch (err) {
            toast.error('Failed to update category');
        }
    };

    const handleDeleteCategory = async (id, name) => {
        if (!window.confirm(`Delete category "${name}"? Existing transactions will keep their history.`)) return;
        try {
            await physicalFinanceService.deleteCategory(id);
            toast.success('Category deleted');
            fetchCategories();
        } catch (err) {
            toast.error('Failed to delete category');
        }
    };

    return (
        <div className="p-4 md:p-6 h-full flex flex-col gap-6 animate-fade-in text-white relative">
            
            {/* Header & Date Picker */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-black/40 backdrop-blur-xl border border-white/20 p-6 rounded-[2rem] shadow-lg">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 drop-shadow-md">
                        <Wallet className="text-emerald-400" /> Cash Flow Dashboard
                    </h2>
                    <p className="text-white/60 text-sm mt-1">Manage daily physical campus income, expenses, and fee collections.</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                    {/* Installment Reminders Button */}
                    <button 
                        onClick={() => {
                            fetchReminders();
                            setIsRemindersModalOpen(true);
                        }}
                        className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-amber-500/30 shadow-md transition-all text-xs relative cursor-pointer"
                        title="View pending & scheduled installment payments requiring verification"
                    >
                        <Bell size={15} className="text-amber-400" />
                        <span>Installment Reminders</span>
                        {reminders.length > 0 && (
                            <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow animate-pulse">
                                {reminders.length}
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => {
                            fetchTrashData();
                            setIsTrashModalOpen(true);
                        }}
                        className="bg-red-500/10 hover:bg-red-500/20 text-red-300 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-red-500/30 shadow-md transition-all text-xs relative"
                        title="View soft-deleted transactions & reasons"
                    >
                        <Archive size={15} className="text-red-400" /> Deleted History (Trash)
                        {trashCount > 0 && (
                            <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
                                {trashCount}
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => setIsCategoryModalOpen(true)}
                        className="bg-white/10 hover:bg-white/20 text-white/90 px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-white/15 shadow-md transition-all text-xs"
                    >
                        <Settings size={15} className="text-blue-400" /> Manage Categories
                    </button>

                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2 rounded-xl">
                        <Calendar size={18} className="text-blue-400" />
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent outline-none text-white font-bold text-sm"
                        />
                    </div>

                    <button 
                        onClick={handleOpenOpeningModal}
                        className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 border border-amber-500/30 shadow-md transition-all text-xs cursor-pointer"
                        title="Set or adjust opening balance (ආරම්භක ශේෂය) for this date"
                    >
                        <Coins size={15} className="text-amber-400" />
                        <span>Opening Balance</span>
                        {summary.isManualOpeningBalance && (
                            <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.2 rounded-full shadow">
                                SET
                            </span>
                        )}
                    </button>

                    <button 
                        onClick={() => setIsPrintSheetOpen(true)}
                        className="bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 hover:text-white px-4 py-2.5 rounded-xl font-black flex items-center gap-2 border border-emerald-500/40 shadow-lg shadow-emerald-950/40 transition-all text-xs cursor-pointer active:scale-95"
                        title="Open official A4 Daily Cash Flow sheet to print, sign, and attach to file"
                    >
                        <Printer size={15} className="text-emerald-400" />
                        <span>Print Daily Sheet (A4)</span>
                    </button>
                    
                    <button 
                        onClick={() => {
                            const available = categories.filter(c => c.type === formData.type);
                            if (available.length > 0 && !formData.category) {
                                setFormData(prev => ({ 
                                    ...prev, 
                                    category: available[0].name,
                                    date: selectedDate 
                                }));
                            } else {
                                setFormData(prev => ({ ...prev, date: selectedDate }));
                            }
                            setIsAddModalOpen(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/30 transition-all hover:-translate-y-0.5 text-sm"
                    >
                        <Plus size={18} /> Add Entry
                    </button>
                </div>
            </div>

            {/* Installments Due / Pending Verification Alert Banner */}
            {reminders.length > 0 && (
                <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-black/70 border border-amber-500/40 p-4 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/30 animate-in fade-in">
                    <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/40 shrink-0">
                            <AlertTriangle size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-sm font-black text-amber-200">
                                    {reminders.length} Scheduled Installment{reminders.length > 1 ? 's' : ''} Pending Verification
                                </h4>
                                <span className="text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-black uppercase">
                                    Action Required
                                </span>
                            </div>
                            <p className="text-xs text-white/60 mt-0.5">
                                වාරික වශයෙන් යොදවා ඇති වියදම් / ආදායම් අදාළ දිනට ගෙවූ බව හෝ ලැබුණු බව තහවුරු (Verify) කරන්න.
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={() => {
                            fetchReminders();
                            setIsRemindersModalOpen(true);
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-xl text-xs font-black transition-all shrink-0 shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <CheckCircle size={14} /> Review & Verify ({reminders.length})
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                {/* 1. Opening Balance Card */}
                <div className="bg-gradient-to-br from-amber-500/15 via-amber-950/20 to-black/40 border border-amber-500/30 p-5 rounded-3xl flex flex-col justify-between relative overflow-hidden shadow-[0_4px_20px_rgba(245,158,11,0.12)]">
                    <div className="absolute -right-3 -bottom-3 text-amber-500/10 pointer-events-none"><Coins size={110} /></div>
                    <div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <p className="text-amber-400 text-xs font-bold uppercase tracking-wider">Opening Balance</p>
                            <button 
                                onClick={handleOpenOpeningModal}
                                className="text-[10px] text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded-lg border border-amber-500/30 font-bold flex items-center gap-1 transition-colors"
                                title="Set / Edit Opening Balance (ආරම්භක ශේෂය)"
                            >
                                <Edit2 size={10} /> {summary.isManualOpeningBalance ? 'Edit' : 'Set'}
                            </button>
                        </div>
                        <h3 className="text-3xl font-black text-white relative z-10 drop-shadow-md">
                            Rs. {(summary.openingBalance || 0).toLocaleString()}
                        </h3>
                    </div>
                    <div className="mt-3 relative z-10 flex items-center gap-1.5 text-[10px]">
                        {summary.isManualOpeningBalance ? (
                            <span className="text-amber-300 font-bold bg-amber-500/25 px-2 py-0.5 rounded-md border border-amber-500/40">
                                ⭐ Manually Set
                            </span>
                        ) : (
                            <span className="text-blue-300 font-medium bg-blue-500/15 px-2 py-0.5 rounded-md border border-blue-500/20">
                                🔄 Carried Forward
                            </span>
                        )}
                    </div>
                </div>

                {/* 2. Total Income Card */}
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-3xl flex flex-col justify-between relative overflow-hidden shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
                    <div className="absolute -right-3 -bottom-3 text-emerald-500/10 pointer-events-none"><TrendingUp size={110} /></div>
                    <div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Total Income (Inflow)</p>
                            <span className="text-[10px] font-mono text-emerald-300/80 bg-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
                                {transactions.filter(t => t.type === 'INCOME').length} Txns
                            </span>
                        </div>
                        <h3 className="text-3xl font-black text-white relative z-10 drop-shadow-md">
                            Rs. {(summary.totalIncome || 0).toLocaleString()}
                        </h3>
                    </div>
                    <div className="mt-3 relative z-10 pt-2 border-t border-emerald-500/20 flex flex-wrap justify-between text-[10px] text-emerald-300 font-semibold gap-1">
                        <span>💵 Cash: Rs. {(summary.cashIncome !== undefined ? summary.cashIncome : summary.totalIncome).toLocaleString()}</span>
                        {(summary.nonCashIncome || 0) > 0 && (
                            <span className="text-blue-300">🏦 Bank: Rs. {(summary.nonCashIncome || 0).toLocaleString()}</span>
                        )}
                    </div>
                </div>

                {/* 3. Total Expenses Card */}
                <div className="bg-red-500/10 border border-red-500/30 p-5 rounded-3xl flex flex-col justify-between relative overflow-hidden shadow-[0_4px_20px_rgba(239,68,68,0.15)]">
                    <div className="absolute -right-3 -bottom-3 text-red-500/10 pointer-events-none"><TrendingDown size={110} /></div>
                    <div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <p className="text-red-400 text-xs font-bold uppercase tracking-wider">Total Expense (Outflow)</p>
                            <span className="text-[10px] font-mono text-red-300/80 bg-red-500/20 px-2 py-0.5 rounded-md font-bold">
                                {transactions.filter(t => t.type === 'EXPENSE').length} Txns
                            </span>
                        </div>
                        <h3 className="text-3xl font-black text-white relative z-10 drop-shadow-md">
                            Rs. {(summary.totalExpense || 0).toLocaleString()}
                        </h3>
                    </div>
                    <div className="mt-3 relative z-10 pt-2 border-t border-red-500/20 flex flex-wrap justify-between text-[10px] text-red-300 font-semibold gap-1">
                        <span>💵 Cash: Rs. {(summary.cashExpense !== undefined ? summary.cashExpense : summary.totalExpense).toLocaleString()}</span>
                        {(summary.nonCashExpense || 0) > 0 && (
                            <span className="text-blue-300">🏦 Bank: Rs. {(summary.nonCashExpense || 0).toLocaleString()}</span>
                        )}
                    </div>
                </div>

                {/* 4. Day's Closing Balance / Cash in Hand */}
                <div className={`p-5 rounded-3xl flex flex-col justify-between relative overflow-hidden shadow-[0_8px_30px_rgba(59,130,246,0.35)] border ${
                    (summary.closingBalance !== undefined ? summary.closingBalance : summary.netCash || 0) >= 0 
                        ? 'bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 border-blue-400/50' 
                        : 'bg-gradient-to-tr from-rose-700 to-rose-500 border-rose-400/50'
                }`}>
                    <div className="absolute -right-3 -bottom-3 text-white/10 pointer-events-none"><Wallet size={110} /></div>
                    <div>
                        <div className="flex justify-between items-start mb-2 relative z-10">
                            <p className="text-blue-100 text-xs font-bold uppercase tracking-wider">
                                Closing Cash In Hand
                            </p>
                            <span className="text-[10px] font-bold text-white bg-white/20 px-2 py-0.5 rounded-md">
                                Drawer
                            </span>
                        </div>
                        <h3 className="text-3xl font-black text-white relative z-10 drop-shadow-lg">
                            Rs. {(summary.closingBalance !== undefined ? summary.closingBalance : summary.netCash || 0).toLocaleString()}
                        </h3>
                    </div>
                    <p className="text-[10px] text-blue-100/90 font-bold mt-3 relative z-10 flex items-center gap-1">
                        ↳ Matches Physical Drawer Cash (අතැති මුදල)
                    </p>
                </div>
            </div>

            {/* Transaction List */}
            <div className="bg-black/40 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-lg flex-1 overflow-hidden flex flex-col min-h-[400px]">
                <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold">Transaction History</h3>
                        <span className="text-xs text-white/50 bg-white/5 px-3 py-1 rounded-full border border-white/10 font-bold">
                            {filteredTransactions.length} of {transactions.length} entries on {selectedDate}
                        </span>
                    </div>
                    
                    {/* Search Bar */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                        <input 
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search student, class, category..."
                            className="w-full bg-black/40 border border-white/15 rounded-xl pl-10 pr-8 py-2 text-xs text-white placeholder-white/40 outline-none focus:border-blue-500/60 focus:bg-black/60 transition-all font-medium shadow-inner"
                        />
                        {searchQuery && (
                            <button 
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white bg-white/10 hover:bg-white/20 p-1 rounded-md transition-colors"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="p-6 overflow-auto flex-1 custom-scrollbar">
                    {loading ? (
                        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div></div>
                    ) : transactions.length === 0 ? (
                        <div className="text-center py-16 text-white/40 font-semibold flex flex-col items-center gap-2">
                            <Wallet size={40} className="opacity-30 mb-2" />
                            <span>No active transactions found for this date.</span>
                            <span className="text-xs text-white/30">Click "Add Entry" to record daily income or expenses.</span>
                        </div>
                    ) : filteredTransactions.length === 0 ? (
                        <div className="text-center py-16 text-white/40 font-semibold flex flex-col items-center gap-2">
                            <Search size={40} className="opacity-30 mb-2" />
                            <span>No transactions match "{searchQuery}".</span>
                            <button onClick={() => setSearchQuery('')} className="text-xs text-blue-400 hover:underline mt-1 font-bold">Clear Search Filter</button>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-white/10 text-white/50 text-xs uppercase tracking-wider">
                                    <th className="pb-3 font-semibold">Type</th>
                                    <th className="pb-3 font-semibold">Category</th>
                                    <th className="pb-3 font-semibold">Description / Student</th>
                                    <th className="pb-3 font-semibold text-center">Drawer Impact / Mode</th>
                                    <th className="pb-3 font-semibold text-right">Amount (Rs)</th>
                                    <th className="pb-3 font-semibold text-center">Action / Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {filteredTransactions.map((t) => (
                                    <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="py-4">
                                            {t.type === 'INCOME' ? (
                                                <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md text-xs font-bold border border-emerald-500/20">INCOME</span>
                                            ) : (
                                                <span className="text-red-400 bg-red-500/10 px-2.5 py-1 rounded-md text-xs font-bold border border-red-500/20">EXPENSE</span>
                                            )}
                                        </td>
                                        <td className="py-4">
                                            <span className="font-bold text-white/90 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10 text-xs">
                                                {t.category}
                                            </span>
                                        </td>
                                        <td className="py-4">
                                            <div className="font-medium text-white/90">{t.description || '-'}</div>
                                            {t.teacher && (
                                                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm">
                                                        <span>👨‍🏫 Lecturer: {t.teacher.name}</span>
                                                        <span className="font-mono text-[10px] bg-purple-500/30 text-purple-200 px-1.5 py-0.2 rounded border border-purple-400/30">
                                                            {t.teacher.lecturerId || (`IMA-LEC-${1000 + t.teacher.id}`)}
                                                        </span>
                                                    </span>
                                                    {t.billingMonth && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                                                            📅 Deduct Cycle: {t.billingMonth}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            {t.description?.includes('[HALF CARD]') && (
                                                <div className="mt-1">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-sm">
                                                        🏷️ HALF CARD (50% Concession)
                                                    </span>
                                                </div>
                                            )}
                                            {t.student && (
                                                <div className="text-xs text-blue-400 font-semibold mt-0.5">
                                                    🎓 {t.student.studentName || `${t.student.firstName || ''} ${t.student.lastName || ''}`.trim()} ({t.student.studentId})
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 text-center">
                                            <div className="flex flex-col items-center justify-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleTxCashImpact(t)}
                                                    title="Click to toggle: Real Cash in Hand vs Non-Cash (Bank)"
                                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm ${
                                                        t.affectsCash === false 
                                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30' 
                                                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                                    }`}
                                                >
                                                    {t.affectsCash === false ? (
                                                        <>🏦 Non-Cash ({t.paymentMethod || 'Bank'})</>
                                                    ) : (
                                                        <>💵 Real Cash</>
                                                    )}
                                                </button>
                                                {t.installmentPlanId && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/35">
                                                        🗓️ Inst {t.installmentNo}/{t.totalInstallments}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`py-4 text-right font-black text-base ${t.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {t.type === 'INCOME' ? '+' : '-'}{t.amount.toLocaleString()}
                                        </td>
                                        <td className="py-4 text-center">
                                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                                {/* If pending verification: Show prominent verify button */}
                                                {(t.isVerified === false || t.status === 'PENDING_VERIFICATION') ? (
                                                    <button 
                                                        onClick={() => handleVerifyTransaction(t.id, false)} 
                                                        className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-[10px] font-black transition-all flex items-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer active:scale-95"
                                                        title="Click to verify and apply this installment to Cash Flow"
                                                    >
                                                        <Check size={12} /> Verify & Settle
                                                    </button>
                                                ) : t.installmentPlanId ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30">
                                                        ✓ Settled
                                                    </span>
                                                ) : null}

                                                <button 
                                                    onClick={() => handlePrintReceipt(t)} 
                                                    className={`${t.type === 'EXPENSE' ? 'text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20' : 'text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20'} p-2 rounded-lg transition-all`}
                                                    title={t.type === 'EXPENSE' ? 'Print 80mm Expense Voucher (Xprinter)' : 'Print 80mm Thermal Receipt (Xprinter)'}
                                                >
                                                    <Printer size={15} />
                                                </button>
                                                <button 
                                                    onClick={() => handleInitiateDelete(t)} 
                                                    className="text-white/30 hover:text-red-400 transition-colors p-2 bg-white/5 rounded-lg hover:bg-white/10"
                                                    title="Delete transaction (Require reason & move to Trash)"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Daily Settlement Summary Footer Banner */}
                <div className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-900/80 to-purple-950/60 border-t border-white/10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <Coins size={20} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-white flex items-center gap-2">
                                <span>Day Balance Settlement ({selectedDate})</span>
                                {summary.isManualOpeningBalance && (
                                    <span className="bg-amber-500/20 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                                        Manual Opening
                                    </span>
                                )}
                            </h4>
                            <p className="text-[11px] text-white/50">
                                Opening balance settles with today's collections & expenses to yield the closing balance.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <div className="bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                            <span className="text-white/50 font-normal">Opening:</span>
                            <span className="text-amber-300 font-extrabold">Rs. {(summary.openingBalance || 0).toLocaleString()}</span>
                        </div>
                        <span className="text-white/30">+</span>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                            <span className="text-emerald-400/70 font-normal">Income:</span>
                            <span className="text-emerald-400 font-extrabold">Rs. {(summary.totalIncome || 0).toLocaleString()}</span>
                        </div>
                        <span className="text-white/30">-</span>
                        <div className="bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                            <span className="text-red-400/70 font-normal">Expense:</span>
                            <span className="text-red-400 font-extrabold">Rs. {(summary.totalExpense || 0).toLocaleString()}</span>
                        </div>
                        <span className="text-white/30">=</span>
                        <div className="bg-blue-600/30 border border-blue-400/40 px-3.5 py-1.5 rounded-xl flex items-center gap-2 text-blue-200 shadow-lg shadow-blue-500/10">
                            <span className="text-white/70 font-normal">Closing Balance:</span>
                            <span className="text-white font-black text-sm">Rs. {(summary.closingBalance !== undefined ? summary.closingBalance : summary.netCash || 0).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Transaction Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex justify-center items-center p-3 md:p-6">
                    <div className="bg-[#151524] border border-white/20 p-6 md:p-9 lg:p-10 rounded-[2.2rem] w-full max-w-5xl xl:max-w-6xl max-h-[92vh] overflow-y-auto custom-scrollbar shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white">
                        <button 
                            onClick={() => {
                                setIsAddModalOpen(false);
                                setLecturerSearchTerm('');
                                setIsSelectingLecturer(false);
                            }} 
                            className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-3 rounded-2xl cursor-pointer"
                        >
                            <X size={24} />
                        </button>
                        
                        <div className="flex items-center gap-4 mb-7 pb-5 border-b border-white/10">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0 shadow-lg shadow-blue-500/10">
                                <Plus size={30} />
                            </div>
                            <div>
                                <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-white tracking-wide">Record Transaction Entry</h2>
                                <p className="text-sm md:text-base text-white/70 mt-1">Add daily cash flow income, operational expense, or teacher advance.</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleAddTransaction} className="space-y-6 md:space-y-7">
                            {/* Row 1: Date & Type */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                                <div>
                                    <label className="block text-sm md:text-base font-extrabold text-white/85 uppercase tracking-wider mb-2.5">
                                        Date (දිනය) *
                                    </label>
                                    <div className="relative">
                                        <Calendar size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                                        <input 
                                            type="date" 
                                            required
                                            value={formData.date || selectedDate}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="w-full bg-black/40 border border-white/15 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold text-base md:text-lg shadow-inner cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm md:text-base font-extrabold text-white/85 uppercase tracking-wider mb-2.5">
                                        Entry Type (වර්ගය) *
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleTypeChange('INCOME')}
                                            className={`py-4 px-5 rounded-xl font-black text-base md:text-lg transition-all border flex items-center justify-center gap-2.5 cursor-pointer ${
                                                formData.type === 'INCOME'
                                                    ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-950/40'
                                                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            <TrendingUp size={22} className="text-emerald-400" />
                                            <span>INCOME</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleTypeChange('EXPENSE')}
                                            className={`py-4 px-5 rounded-xl font-black text-base md:text-lg transition-all border flex items-center justify-center gap-2.5 cursor-pointer ${
                                                formData.type === 'EXPENSE'
                                                    ? 'bg-red-600/30 text-red-300 border-red-500/60 shadow-lg shadow-red-950/40'
                                                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            <TrendingDown size={22} className="text-red-400" />
                                            <span>EXPENSE</span>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Category */}
                            <div>
                                <div className="flex justify-between items-center mb-2.5">
                                    <label className="block text-sm md:text-base font-extrabold text-white/85 uppercase tracking-wider">
                                        Finance Category (කාණ්ඩය) *
                                    </label>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCategoryModalOpen(true)}
                                        className="text-xs md:text-sm text-blue-400 hover:text-blue-300 font-bold flex items-center gap-2 bg-blue-500/10 px-3.5 py-1.5 rounded-xl border border-blue-500/20 transition-all cursor-pointer hover:bg-blue-500/20"
                                    >
                                        <Settings size={15} /> Manage Categories
                                    </button>
                                </div>
                                <select 
                                    required
                                    value={formData.category}
                                    onChange={(e) => handleCategoryChange(e.target.value)}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none font-bold text-base md:text-lg shadow-inner cursor-pointer"
                                >
                                    {activeTypeCategories.map(cat => (
                                        <option key={cat.id} value={cat.name} className="text-black text-base">
                                            {cat.name} {cat.isLecturerCategory ? '★ [Lecturer Expense - Deductible]' : ''}
                                        </option>
                                    ))}
                                    {activeTypeCategories.length === 0 && (
                                        <option value="" className="text-black">No categories. Click Manage to add.</option>
                                    )}
                                </select>
                            </div>

                            {/* Lecturer / Teacher Expense Association Box */}
                            {formData.type === 'EXPENSE' && (
                                <div className="bg-gradient-to-br from-purple-950/40 via-purple-900/20 to-black/50 border border-purple-500/35 rounded-2xl p-5 md:p-6 space-y-4 shadow-lg shadow-purple-950/30">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm md:text-base font-black text-purple-200 flex items-center gap-3 cursor-pointer">
                                            <input 
                                                type="checkbox"
                                                checked={formData.isTeacherAdvance || Boolean(formData.teacherId)}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setFormData(prev => ({ 
                                                        ...prev, 
                                                        isTeacherAdvance: checked,
                                                        teacherId: checked ? prev.teacherId : '',
                                                        billingMonth: checked ? (prev.billingMonth || (prev.date ? prev.date.slice(0, 7) : format(new Date(), 'yyyy-MM'))) : ''
                                                    }));
                                                    if (!checked) {
                                                        setIsSelectingLecturer(false);
                                                        setLecturerSearchTerm('');
                                                    }
                                                }}
                                                className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 border-white/20 accent-purple-500 cursor-pointer"
                                            />
                                            <span>👨‍🏫 Link to Lecturer / Teacher Expense (Advance / Payout)</span>
                                        </label>
                                        <span className="text-xs text-purple-300 font-extrabold bg-purple-500/20 px-3 py-1 rounded-full border border-purple-500/40">
                                            Auto-Deduct from Salary
                                        </span>
                                    </div>

                                    {(formData.isTeacherAdvance || Boolean(formData.teacherId)) && (
                                        <div className="space-y-4 pt-3 border-t border-purple-500/25">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Searchable Lecturer Selector */}
                                                <div>
                                                    <label className="block text-xs md:text-sm font-bold text-purple-200 uppercase tracking-wider mb-2 flex items-center justify-between">
                                                        <span>Select Lecturer (ආචාර්යවරයා) *</span>
                                                        {formData.teacherId && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsSelectingLecturer(true);
                                                                    setLecturerSearchTerm('');
                                                                }}
                                                                className="text-xs text-purple-300 hover:text-white underline font-bold"
                                                            >
                                                                Change
                                                            </button>
                                                        )}
                                                    </label>

                                                    {formData.teacherId && !isSelectingLecturer ? (
                                                        // Selected Lecturer Badge Card
                                                        <div className="bg-black/60 border border-purple-500/40 rounded-xl p-3.5 flex items-center justify-between">
                                                            <div className="flex items-center gap-3 min-w-0">
                                                                <div className="w-9 h-9 rounded-lg bg-purple-500/30 text-purple-200 flex items-center justify-center font-black text-xs shrink-0">
                                                                    LEC
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="font-bold text-sm md:text-base text-white truncate">
                                                                        {teachers.find(t => String(t.id) === String(formData.teacherId))?.name || 'Selected Lecturer'}
                                                                    </div>
                                                                    <div className="text-xs font-mono text-purple-300">
                                                                        {teachers.find(t => String(t.id) === String(formData.teacherId))?.lecturerId || (`IMA-LEC-${1000 + parseInt(formData.teacherId)}`)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsSelectingLecturer(true);
                                                                    setLecturerSearchTerm('');
                                                                }}
                                                                className="text-xs md:text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 px-3 py-1.5 rounded-lg border border-purple-500/30 font-bold transition-all shrink-0 ml-2"
                                                            >
                                                                Search / Change
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        // Searchable Combobox
                                                        <div className="space-y-2">
                                                            <div className="relative">
                                                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" />
                                                                <input
                                                                    type="text"
                                                                    autoFocus
                                                                    placeholder="Search lecturer by name or ID (e.g. Shehan, 1006)..."
                                                                    value={lecturerSearchTerm}
                                                                    onChange={(e) => setLecturerSearchTerm(e.target.value)}
                                                                    className="w-full bg-black/60 border border-purple-500/40 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-medium text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-purple-500/60 shadow-inner"
                                                                />
                                                            </div>

                                                            <div className="max-h-44 overflow-y-auto custom-scrollbar bg-black/70 border border-purple-500/30 rounded-xl divide-y divide-white/5">
                                                                {teachers
                                                                    .filter(t => {
                                                                        if (!lecturerSearchTerm.trim()) return true;
                                                                        const q = lecturerSearchTerm.toLowerCase();
                                                                        const lId = (t.lecturerId || `IMA-LEC-${1000 + t.id}`).toLowerCase();
                                                                        return t.name.toLowerCase().includes(q) || lId.includes(q);
                                                                    })
                                                                    .map(t => {
                                                                        const customId = t.lecturerId || `IMA-LEC-${1000 + t.id}`;
                                                                        const isSelected = String(formData.teacherId) === String(t.id);
                                                                        return (
                                                                            <button
                                                                                key={t.id}
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setFormData(prev => ({ ...prev, teacherId: String(t.id) }));
                                                                                    setIsSelectingLecturer(false);
                                                                                    setLecturerSearchTerm('');
                                                                                }}
                                                                                className={`w-full text-left px-3.5 py-2.5 flex items-center justify-between hover:bg-purple-500/20 transition-colors ${
                                                                                    isSelected ? 'bg-purple-500/25 text-purple-200' : 'text-white'
                                                                                }`}
                                                                            >
                                                                                <div className="min-w-0 pr-2">
                                                                                    <div className="font-bold text-sm truncate">{t.name}</div>
                                                                                    <div className="text-xs font-mono text-purple-300/80">{customId}</div>
                                                                                </div>
                                                                                <span className="text-xs font-bold bg-white/5 px-2.5 py-1 rounded border border-white/10 shrink-0">
                                                                                    Select
                                                                                </span>
                                                                            </button>
                                                                        );
                                                                    })}
                                                                {teachers.length === 0 && (
                                                                    <div className="p-3 text-xs text-center text-white/40">No lecturers found.</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Deductible Billing Month */}
                                                <div>
                                                    <label className="block text-xs md:text-sm font-bold text-purple-200 uppercase tracking-wider mb-2">
                                                        Deductible Billing Month *
                                                    </label>
                                                    <input
                                                        type="month"
                                                        required
                                                        value={formData.billingMonth || (formData.date ? formData.date.slice(0, 7) : format(new Date(), 'yyyy-MM'))}
                                                        onChange={(e) => setFormData(prev => ({ ...prev, billingMonth: e.target.value }))}
                                                        className="w-full bg-black/60 border border-purple-500/40 rounded-xl px-4 py-3 text-sm md:text-base font-bold text-white outline-none focus:border-purple-400 cursor-pointer shadow-inner"
                                                    />
                                                    <p className="text-xs md:text-sm text-purple-300/90 mt-2 leading-relaxed">
                                                        💡 මෙම මුදල මෙම ආචාර්යවරයාගේ තෝරාගත් මාසයේ Salary Invoice එකෙන් Auto-Deduct වේ.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Row 3: Amount & Payment Method / Drawer Impact */}
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm md:text-base font-extrabold text-white/85 uppercase tracking-wider mb-2.5">
                                        Total Amount in LKR (මුළු මුදල) *
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40 font-black text-2xl md:text-3xl pointer-events-none">
                                            Rs.
                                        </span>
                                        <input 
                                            type="number" 
                                            required 
                                            step="any"
                                            value={formData.amount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setFormData(prev => {
                                                    const updated = { ...prev, amount: val };
                                                    if (prev.isInstallment && prev.installmentCount) {
                                                        updated.installments = generateInstallmentRows(prev.installmentCount, val, prev.date, prev.paymentMethod, prev.affectsCash);
                                                    }
                                                    return updated;
                                                });
                                            }}
                                            className="w-full bg-black/40 border border-white/15 rounded-2xl pl-20 pr-5 py-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-3xl md:text-4xl font-black shadow-inner"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>

                                {/* Real Cash Impact Tick Box (Drawer Cash Decision) */}
                                <div className={`p-6 md:p-7 rounded-2xl border transition-all duration-200 ${
                                    formData.affectsCash
                                        ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/60 to-black/80 border-emerald-500/50 shadow-xl shadow-emerald-950/30'
                                        : 'bg-gradient-to-br from-blue-950/30 via-slate-900/60 to-black/80 border-blue-500/40 shadow-xl shadow-blue-950/30'
                                }`}>
                                    <div className="flex items-start justify-between gap-3.5">
                                        <label className="flex items-start gap-4 cursor-pointer select-none flex-1">
                                            <input 
                                                type="checkbox"
                                                id="affectsRealCashTick"
                                                checked={formData.affectsCash}
                                                onChange={(e) => {
                                                    const checked = e.target.checked;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        affectsCash: checked,
                                                        paymentMethod: checked ? 'CASH' : (prev.paymentMethod === 'CASH' ? 'BANK' : prev.paymentMethod),
                                                        installments: prev.isInstallment 
                                                            ? prev.installments.map(ins => ({ 
                                                                ...ins, 
                                                                affectsCash: checked, 
                                                                paymentMethod: checked ? 'CASH' : (ins.paymentMethod === 'CASH' ? 'BANK' : ins.paymentMethod) 
                                                              })) 
                                                            : prev.installments
                                                    }));
                                                }}
                                                className="w-6 h-6 mt-0.5 rounded-md text-emerald-500 focus:ring-emerald-500 border-white/20 accent-emerald-500 cursor-pointer shrink-0"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <span className="text-base md:text-lg lg:text-xl font-black text-white">
                                                        {formData.affectsCash 
                                                            ? '💵 Affects Real Cash (භෞතික Cash Drawer එකට බලපෑමක් වේ)' 
                                                            : '🏦 Non-Cash (Cash Drawer එකට බලපෑමක් නැත)'}
                                                    </span>
                                                    <span className={`text-xs md:text-sm font-black uppercase px-3.5 py-1 rounded-full border ${
                                                        formData.affectsCash 
                                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm' 
                                                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40 shadow-sm'
                                                    }`}>
                                                        {formData.affectsCash ? '✓ REAL CASH IN HAND' : 'NON-CASH / BANK'}
                                                    </span>
                                                </div>
                                                <p className="text-sm md:text-base text-white/90 mt-2 leading-relaxed">
                                                    {formData.affectsCash ? (
                                                        <span className="text-emerald-300 font-semibold">
                                                            💡 මෙම මුදල සැබෑ Physical Cash Drawer එකෙන් {formData.type === 'EXPENSE' ? 'අඩු වේ (Deduct වේ)' : 'එකතු වේ (Add වේ)'}. දවසේ Cash-in-Hand ශේෂය වෙනස් වේ.
                                                        </span>
                                                    ) : (
                                                        <span className="text-blue-300 font-semibold">
                                                            💡 Bank Transfer / Cheque / Online / Slip මඟින් සිදු වූවක් බැවින් Physical Drawer ශේෂය වෙනස් නොවේ.
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </label>
                                    </div>

                                    <div className="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs md:text-sm font-bold text-white/60 uppercase tracking-wider">Quick Select:</span>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        affectsCash: true,
                                                        paymentMethod: 'CASH',
                                                        installments: prev.isInstallment ? prev.installments.map(ins => ({ ...ins, affectsCash: true, paymentMethod: 'CASH' })) : prev.installments
                                                    }));
                                                }}
                                                className={`px-5 py-2.5 rounded-xl text-sm md:text-base font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                                                    formData.affectsCash
                                                        ? 'bg-emerald-600/30 border-emerald-500/60 text-emerald-200 shadow-md'
                                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                                }`}
                                            >
                                                <span>💵 Real Cash</span>
                                                {formData.affectsCash && <Check size={16} className="text-emerald-400" />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        affectsCash: false,
                                                        paymentMethod: 'BANK',
                                                        installments: prev.isInstallment ? prev.installments.map(ins => ({ ...ins, affectsCash: false, paymentMethod: 'BANK' })) : prev.installments
                                                    }));
                                                }}
                                                className={`px-5 py-2.5 rounded-xl text-sm md:text-base font-bold transition-all border flex items-center gap-2 cursor-pointer ${
                                                    !formData.affectsCash
                                                        ? 'bg-blue-600/30 border-blue-500/60 text-blue-200 shadow-md'
                                                        : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                                                }`}
                                            >
                                                <span>🏦 Bank / Non-Cash</span>
                                                {!formData.affectsCash && <Check size={16} className="text-blue-400" />}
                                            </button>
                                        </div>

                                        {!formData.affectsCash && (
                                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                                <span className="text-xs md:text-sm font-bold text-blue-300 uppercase shrink-0">Channel:</span>
                                                <select
                                                    value={formData.paymentMethod === 'CASH' ? 'BANK' : formData.paymentMethod}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                                                    className="bg-black/60 border border-blue-500/40 rounded-xl px-4 py-2 text-sm md:text-base font-bold text-blue-200 outline-none cursor-pointer w-full sm:w-auto"
                                                >
                                                    <option value="BANK" className="text-black">Bank Transfer</option>
                                                    <option value="ONLINE" className="text-black">Online / Gateway</option>
                                                    <option value="CHEQUE" className="text-black">Cheque</option>
                                                    <option value="SLIP" className="text-black">Bank Deposit Slip</option>
                                                    <option value="OTHER" className="text-black">Other Non-Drawer</option>
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Row 4: Installment Scheduling Toggle & Dynamic Plan Generator */}
                            <div className="bg-gradient-to-br from-amber-950/30 via-slate-900/50 to-black/60 border border-amber-500/30 rounded-2xl p-5 md:p-7 space-y-5 shadow-lg shadow-amber-950/20">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                    <label className="text-base md:text-lg font-black text-amber-200 flex items-center gap-3 cursor-pointer select-none">
                                        <input 
                                            type="checkbox"
                                            checked={formData.isInstallment}
                                            onChange={(e) => handleToggleInstallment(e.target.checked)}
                                            className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500 border-white/20 accent-amber-500 cursor-pointer"
                                        />
                                        <span>🗓️ Plan in Installments (වාරික වශයෙන් ගෙවීම / ලැබීම)</span>
                                    </label>
                                    <span className="text-xs md:text-sm text-amber-300 font-extrabold bg-amber-500/20 px-3.5 py-1.5 rounded-full border border-amber-500/40">
                                        Multi-Part Schedule
                                    </span>
                                </div>

                                {formData.isInstallment && (
                                    <div className="space-y-4 pt-4 border-t border-amber-500/20">
                                        {/* Installment Controls Bar */}
                                        <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-4 rounded-xl border border-white/10">
                                            <div className="flex items-center gap-3">
                                                <span className="text-sm md:text-base font-bold text-white/80">Number of Installments:</span>
                                                <select
                                                    value={formData.installmentCount}
                                                    onChange={(e) => handleInstallmentCountChange(e.target.value)}
                                                    className="bg-black/60 border border-amber-500/40 rounded-xl px-4 py-2 text-sm md:text-base font-black text-amber-300 outline-none cursor-pointer"
                                                >
                                                    {[2, 3, 4, 5, 6, 8, 10, 12].map(num => (
                                                        <option key={num} value={num} className="text-black">
                                                            {num} Installments
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-2.5">
                                                <button
                                                    type="button"
                                                    onClick={handleDistributeEvenly}
                                                    className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-xl text-sm md:text-base font-bold transition-all cursor-pointer"
                                                >
                                                    Distribute Evenly
                                                </button>
                                                {/* Sum vs Total planned status */}
                                                {(() => {
                                                    const targetTotal = parseFloat(formData.amount) || 0;
                                                    const sumInst = formData.installments.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
                                                    const diff = targetTotal - sumInst;
                                                    const isBalanced = targetTotal > 0 && Math.abs(diff) < 0.01;
                                                    return (
                                                        <span className={`text-xs md:text-sm font-black px-3.5 py-2 rounded-xl border ${
                                                            isBalanced 
                                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                                                                : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                                        }`}>
                                                            {isBalanced ? '✓ Balanced (Rs. ' + targetTotal.toLocaleString() + ')' : `Balance Remainder: Rs. ${diff.toLocaleString()}`}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>

                                        {/* Dynamic Installments Table */}
                                        <div className="max-h-64 overflow-y-auto custom-scrollbar border border-white/10 rounded-xl bg-black/50">
                                            <table className="w-full text-left border-collapse text-sm md:text-base">
                                                <thead className="bg-white/5 sticky top-0 text-white/80 font-bold border-b border-white/10">
                                                    <tr>
                                                        <th className="py-3 px-3.5 w-12 text-center">#</th>
                                                        <th className="py-3 px-3.5">Due Date (ගෙවිය යුතු දිනය)</th>
                                                        <th className="py-3 px-3.5">Amount (මුදල - Rs)</th>
                                                        <th className="py-3 px-3.5">Mode & Drawer Impact</th>
                                                        <th className="py-3 px-3.5">Note / Details</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {formData.installments.map((inst, idx) => (
                                                        <tr key={idx} className="hover:bg-white/5 transition-colors">
                                                            <td className="py-3 px-3.5 text-center font-bold text-amber-400">
                                                                #{idx + 1}
                                                            </td>
                                                            <td className="py-3 px-3.5">
                                                                <input 
                                                                    type="date" 
                                                                    required
                                                                    value={inst.dueDate}
                                                                    onChange={(e) => handleInstallmentFieldChange(idx, 'dueDate', e.target.value)}
                                                                    className="bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm md:text-base font-bold text-white outline-none w-40 cursor-pointer"
                                                                />
                                                            </td>
                                                            <td className="py-3 px-3.5">
                                                                <input 
                                                                    type="number" 
                                                                    required 
                                                                    step="any"
                                                                    placeholder="0.00"
                                                                    value={inst.amount}
                                                                    onChange={(e) => handleInstallmentFieldChange(idx, 'amount', e.target.value)}
                                                                    className="bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm md:text-base font-black text-amber-300 outline-none w-36"
                                                                />
                                                            </td>
                                                            <td className="py-3 px-3.5">
                                                                <select
                                                                    value={inst.affectsCash ? 'CASH' : 'BANK'}
                                                                    onChange={(e) => {
                                                                        const isCash = e.target.value === 'CASH';
                                                                        handleInstallmentFieldChange(idx, 'affectsCash', isCash);
                                                                        handleInstallmentFieldChange(idx, 'paymentMethod', isCash ? 'CASH' : 'BANK');
                                                                    }}
                                                                    className="bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm md:text-base font-bold text-white outline-none cursor-pointer"
                                                                >
                                                                    <option value="CASH" className="text-black">💵 Cash In Hand (Drawer)</option>
                                                                    <option value="BANK" className="text-black">🏦 Bank / Non-Drawer</option>
                                                                </select>
                                                            </td>
                                                            <td className="py-3 px-3.5">
                                                                <input 
                                                                    type="text" 
                                                                    placeholder="e.g. Advance, Cheque No, Final"
                                                                    value={inst.description}
                                                                    onChange={(e) => handleInstallmentFieldChange(idx, 'description', e.target.value)}
                                                                    className="bg-black/60 border border-white/15 rounded-lg px-3 py-2 text-sm md:text-base text-white placeholder:text-white/20 outline-none w-full"
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <p className="text-xs md:text-sm text-amber-300/90 leading-relaxed font-medium">
                                            💡 මෙම සෑම වාරිකයක්ම අදාළ Due Date එකේදී Cash Flow එකට එකතු වන අතර, දිනපතා Reminders මගින් තහවුරු (Verify) කිරීමට මතක් කරනු ලැබේ.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Row 5: Description */}
                            <div>
                                <label className="block text-sm md:text-base font-extrabold text-white/85 uppercase tracking-wider mb-2.5">
                                    Description / Remarks (විස්තරය)
                                </label>
                                <textarea 
                                    rows={2}
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-3.5 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[90px] shadow-inner text-base md:text-lg"
                                    placeholder="Optional details (e.g. October Salary Advance, Paper printing costs, Transport allowance, Cheque number)..."
                                ></textarea>
                            </div>

                            <div className="flex items-center gap-4 pt-3">
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsAddModalOpen(false);
                                        setLecturerSearchTerm('');
                                        setIsSelectingLecturer(false);
                                    }} 
                                    className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-base transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="flex-2 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black shadow-lg shadow-blue-500/30 transition-all text-base md:text-lg tracking-wider flex items-center justify-center gap-2.5 cursor-pointer active:scale-95"
                                >
                                    <Plus size={22} /> 
                                    {formData.isInstallment ? `Schedule ${formData.installmentCount} Installments` : 'Save Transaction Entry'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* INSTALLMENT REMINDERS & VERIFICATION MODAL */}
            {isRemindersModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-center items-center p-4">
                    <div className="bg-[#151522] border border-amber-500/30 p-6 md:p-8 rounded-[2rem] w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white">
                        <button 
                            onClick={() => setIsRemindersModalOpen(false)} 
                            className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-xl"
                        >
                            <X size={20} />
                        </button>

                        <div className="flex items-center gap-3.5 mb-6 pb-4 border-b border-white/10">
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/40 shadow">
                                <Bell size={24} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-xl font-black text-white">Scheduled Installment Reminders</h3>
                                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
                                        {reminders.length} Pending
                                    </span>
                                </div>
                                <p className="text-xs text-white/50 mt-0.5">
                                    Verify scheduled installments to confirm payment receipt or outflow into physical cash flow.
                                </p>
                            </div>
                        </div>

                        {/* Reminders List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
                            {reminders.length === 0 ? (
                                <div className="text-center py-16 text-white/40 flex flex-col items-center gap-2">
                                    <CheckCircle size={44} className="text-emerald-400/50 mb-2" />
                                    <span className="font-bold text-white/80">No Pending Installment Reminders</span>
                                    <span className="text-xs text-white/40">All scheduled installments have been verified and settled.</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {reminders.map((rem) => {
                                        const dueD = rem.dueDate ? new Date(rem.dueDate) : new Date(rem.date);
                                        const now = new Date();
                                        const isDueToday = rem.dueDate && format(dueD, 'yyyy-MM-dd') === format(now, 'yyyy-MM-dd');
                                        const isOverdue = dueD < new Date(now.getFullYear(), now.getMonth(), now.getDate());

                                        return (
                                            <div 
                                                key={rem.id} 
                                                className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                                                    isOverdue 
                                                        ? 'bg-rose-950/20 border-rose-500/30' 
                                                        : isDueToday 
                                                            ? 'bg-amber-950/30 border-amber-500/40 shadow-md shadow-amber-950/20' 
                                                            : 'bg-white/5 border-white/10'
                                                }`}
                                            >
                                                <div className="space-y-1.5 flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                                            rem.type === 'INCOME' ? 'text-emerald-300 bg-emerald-500/20' : 'text-rose-300 bg-rose-500/20'
                                                        }`}>
                                                            {rem.type}
                                                        </span>
                                                        <span className="font-black text-xs text-white">
                                                            {rem.category}
                                                        </span>
                                                        <span className="text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded font-black">
                                                            Inst {rem.installmentNo}/{rem.totalInstallments}
                                                        </span>
                                                        {isOverdue && (
                                                            <span className="text-[10px] bg-rose-500 text-white px-2 py-0.5 rounded-full font-black animate-pulse">
                                                                ⚠️ OVERDUE
                                                            </span>
                                                        )}
                                                        {isDueToday && (
                                                            <span className="text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-black">
                                                                🔔 DUE TODAY
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div className="text-xs text-white/90 font-medium truncate">
                                                        {rem.description || 'Installment Payment'}
                                                    </div>

                                                    <div className="flex items-center gap-3 text-[11px] text-white/50 flex-wrap">
                                                        <span className="flex items-center gap-1 font-semibold text-white/70">
                                                            <Calendar size={12} className="text-amber-400" /> 
                                                            Due: {format(dueD, 'dd MMM yyyy')}
                                                        </span>
                                                        <span>•</span>
                                                        <span>
                                                            {rem.affectsCash === false ? '🏦 Bank / Non-Cash' : '💵 Cash in Hand'}
                                                        </span>
                                                        {rem.teacher && (
                                                            <>
                                                                <span>•</span>
                                                                <span className="text-purple-300 font-semibold">👨‍🏫 {rem.teacher.name}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 shrink-0">
                                                    <div className="text-right">
                                                        <span className="text-[10px] text-white/40 block">Amount</span>
                                                        <span className={`text-base font-black ${rem.type === 'INCOME' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            Rs. {rem.amount.toLocaleString()}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={async () => {
                                                            await handleVerifyTransaction(rem.id, false);
                                                        }}
                                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                                                    >
                                                        <Check size={14} /> Verify & Settle
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                            <button
                                onClick={() => setIsRemindersModalOpen(false)}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SET OPENING BALANCE MODAL */}
            {isOpeningModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-center items-center p-4">
                    <div className="bg-[#151522] border border-amber-500/30 p-6 rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white">
                        <button 
                            onClick={() => setIsOpeningModalOpen(false)} 
                            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-xl"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-5">
                            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                                <Coins size={22} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Set Opening Balance</h3>
                                <p className="text-xs text-white/50">ආරම්භක ශේෂය ඇතුළත් කිරීම</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveOpeningBalance} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                                    Effective Date (අදාළ දිනය) *
                                </label>
                                <div className="relative">
                                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-400 pointer-events-none" />
                                    <input 
                                        type="date"
                                        required
                                        value={openingFormDate}
                                        onChange={(e) => setOpeningFormDate(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-bold text-sm shadow-inner"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                                    Opening Balance Amount (රුපියල්) *
                                </label>
                                <input 
                                    type="number"
                                    step="any"
                                    required
                                    value={openingAmount}
                                    onChange={(e) => setOpeningAmount(e.target.value)}
                                    placeholder="e.g. 50000"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-xl font-black shadow-inner"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">
                                    Note / Description (විස්තරය)
                                </label>
                                <input 
                                    type="text"
                                    value={openingNote}
                                    onChange={(e) => setOpeningNote(e.target.value)}
                                    placeholder="e.g. 08/31 ඉතිරි ශේෂය (Carried over from August 31)"
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-500/40 text-sm shadow-inner"
                                />
                            </div>

                            {/* Helpful Sinhala explainer banner */}
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-amber-200/90 leading-relaxed">
                                💡 <span className="font-bold">ක්‍රියාකාරීත්වය:</span> මෙහි ඇතුළත් කරන ආරම්භක ශේෂය එදින ආදායම් සහ වියදම් සමඟ ගලපා එදින අවසාන ශේෂය ගණනය වේ. එම අවසාන ශේෂය ස්වයංක්‍රීයව පසුදින ආරම්භක ශේෂය බවට පත්වේ.
                            </div>

                            <div className="flex gap-2 pt-2">
                                {summary.isManualOpeningBalance && openingFormDate === selectedDate && (
                                    <button
                                        type="button"
                                        onClick={handleResetOpeningBalance}
                                        disabled={openingLoading}
                                        className="w-1/3 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl font-bold border border-red-500/30 text-xs transition-colors"
                                    >
                                        Reset Auto
                                    </button>
                                )}
                                <button 
                                    type="submit" 
                                    disabled={openingLoading}
                                    className="flex-1 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black rounded-xl shadow-lg shadow-amber-500/20 transition-all text-sm cursor-pointer"
                                >
                                    {openingLoading ? 'Saving...' : 'Save Opening Balance'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE TRANSACTION REASON MODAL */}
            {isDeleteModalOpen && txToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-center items-center p-4">
                    <div className="bg-[#171827] border border-red-500/30 p-6 rounded-3xl w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white">
                        <button 
                            onClick={() => { setIsDeleteModalOpen(false); setTxToDelete(null); }} 
                            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-xl"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                                <Trash2 size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Delete Transaction</h3>
                                <p className="text-xs text-white/50">Provide a mandatory reason before moving to Trash.</p>
                            </div>
                        </div>

                        {/* Transaction Summary Card */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 mb-4 text-xs space-y-1">
                            <div className="flex justify-between">
                                <span className="text-white/50">Category & Type:</span>
                                <span className="font-bold text-white">{txToDelete.category} ({txToDelete.type})</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-white/50">Amount:</span>
                                <span className="font-black text-emerald-400">Rs. {txToDelete.amount.toLocaleString()}</span>
                            </div>
                            {txToDelete.description && (
                                <div className="flex justify-between">
                                    <span className="text-white/50">Description:</span>
                                    <span className="text-white/80 font-medium truncate max-w-[200px]">{txToDelete.description}</span>
                                </div>
                            )}
                            {txToDelete.student && (
                                <div className="flex justify-between">
                                    <span className="text-white/50">Student:</span>
                                    <span className="text-blue-400 font-bold">
                                        {txToDelete.student.studentName || txToDelete.student.firstName} ({txToDelete.student.studentId})
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Preset Reasons */}
                        <div className="mb-3">
                            <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1.5">Quick Reason Select</label>
                            <div className="flex flex-wrap gap-1.5">
                                {PRESET_DELETE_REASONS.map((preset, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setDeleteReason(preset)}
                                        className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                                            deleteReason === preset 
                                                ? 'bg-red-500/20 text-red-300 border-red-500/50 font-bold' 
                                                : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10'
                                        }`}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reason Form */}
                        <form onSubmit={handleConfirmDelete} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">
                                    Reason for Deletion *
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={deleteReason}
                                    onChange={(e) => setDeleteReason(e.target.value)}
                                    placeholder="Explain why this entry is being deleted (e.g. Duplicate entry, amount entered incorrectly)..."
                                    className="w-full bg-black/50 border border-white/15 rounded-xl p-3 text-xs text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                />
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => { setIsDeleteModalOpen(false); setTxToDelete(null); }}
                                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl text-xs transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={deleteLoading || !deleteReason.trim()}
                                    className="flex-1 py-3 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
                                >
                                    {deleteLoading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Trash2 size={14} /> Move to Trash
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* TRASH / DELETED HISTORY MODAL */}
            {isTrashModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex justify-center items-center p-4">
                    <div className="bg-[#151624] border border-white/20 p-6 rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white flex flex-col">
                        <button 
                            onClick={() => setIsTrashModalOpen(false)} 
                            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-xl"
                        >
                            <X size={18} />
                        </button>

                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30">
                                    <Archive size={20} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Deleted Transactions (Trash)</h3>
                                    <p className="text-xs text-white/50">Audit log of deleted transactions with deletion reasons and restore capability.</p>
                                </div>
                            </div>
                            <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-3 py-1 rounded-full text-xs font-bold mr-8">
                                {trashList.length} deleted records
                            </span>
                        </div>

                        {/* Trash List Table */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            {trashLoading ? (
                                <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin"></div></div>
                            ) : trashList.length === 0 ? (
                                <div className="text-center py-16 text-white/40 flex flex-col items-center gap-2">
                                    <Archive size={40} className="opacity-30 mb-2" />
                                    <span>Trash is empty. No deleted transactions found.</span>
                                </div>
                            ) : (
                                <table className="w-full text-left border-collapse text-xs">
                                    <thead>
                                        <tr className="border-b border-white/10 text-white/50 uppercase tracking-wider">
                                            <th className="pb-3 font-semibold">Type</th>
                                            <th className="pb-3 font-semibold">Category</th>
                                            <th className="pb-3 font-semibold">Details / Student</th>
                                            <th className="pb-3 font-semibold text-right">Amount</th>
                                            <th className="pb-3 font-semibold pl-4">Reason for Deletion</th>
                                            <th className="pb-3 font-semibold">Deleted At</th>
                                            <th className="pb-3 font-semibold text-center">Restore</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {trashList.map((item) => (
                                            <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                                <td className="py-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.type === 'INCOME' ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'}`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="py-3 font-bold text-white/90">{item.category}</td>
                                                <td className="py-3">
                                                    <div className="text-white/80 font-medium">{item.description || '-'}</div>
                                                    {item.student && (
                                                        <div className="text-[11px] text-blue-400 font-semibold">
                                                            🎓 {item.student.studentName || item.student.firstName} ({item.student.studentId})
                                                        </div>
                                                    )}
                                                </td>
                                                <td className={`py-3 text-right font-black ${item.type === 'INCOME' ? 'text-emerald-400' : 'text-red-400'}`}>
                                                    Rs. {item.amount.toLocaleString()}
                                                </td>
                                                <td className="py-3 pl-4">
                                                    <div className="bg-red-500/15 border border-red-500/30 text-red-200 px-2.5 py-1 rounded-lg text-[11px] inline-block font-medium">
                                                        ⚠️ {item.deletedReason || 'No reason specified'}
                                                    </div>
                                                </td>
                                                <td className="py-3 text-white/50 text-[11px]">
                                                    <div>{item.deletedAt ? new Date(item.deletedAt).toLocaleDateString() : '-'}</div>
                                                    <div className="text-[10px] text-white/40">{item.deletedAt ? new Date(item.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                                </td>
                                                <td className="py-3 text-center">
                                                    <button
                                                        onClick={() => handleRestore(item.id)}
                                                        className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold transition-all flex items-center gap-1 mx-auto text-xs shadow"
                                                        title="Restore to active Cash Flow"
                                                    >
                                                        <RotateCcw size={12} /> Restore
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
                            <button 
                                onClick={() => setIsTrashModalOpen(false)}
                                className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CATEGORIES MANAGEMENT MODAL */}
            {isCategoryModalOpen && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex justify-center items-center p-4">
                    <div className="bg-[#151522] border border-white/20 p-6 rounded-3xl w-full max-w-lg shadow-2xl relative animate-in fade-in zoom-in duration-200 text-white">
                        <button onClick={() => setIsCategoryModalOpen(false)} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors bg-white/5 p-2 rounded-xl">
                            <X size={18} />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                            <Tag size={20} className="text-blue-400" /> Manage Finance Categories
                        </h2>
                        <p className="text-xs text-white/50 mb-5">Add new categories or edit/delete existing categories for income and expenses.</p>

                        {/* Add Category Form */}
                        <form onSubmit={handleAddCategory} className="bg-white/5 p-4 rounded-2xl border border-white/10 mb-6 space-y-3">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider block">Add New Category</span>
                            <div className="flex gap-2">
                                <select 
                                    value={newCatType}
                                    onChange={(e) => setNewCatType(e.target.value)}
                                    className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none"
                                >
                                    <option value="EXPENSE" className="text-black">EXPENSE</option>
                                    <option value="INCOME" className="text-black">INCOME</option>
                                </select>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Teacher Advance, Hall Rent, Water Bill"
                                    value={newCatName}
                                    onChange={(e) => setNewCatName(e.target.value)}
                                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none"
                                />
                                <button 
                                    type="submit" 
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow-md shadow-blue-500/20"
                                >
                                    <Plus size={14} /> Add
                                </button>
                            </div>
                            {newCatType === 'EXPENSE' && (
                                <label className="flex items-center gap-2 text-xs text-purple-300 font-medium cursor-pointer pt-1">
                                    <input 
                                        type="checkbox"
                                        checked={newCatIsLecturer}
                                        onChange={(e) => setNewCatIsLecturer(e.target.checked)}
                                        className="w-3.5 h-3.5 rounded text-purple-600 focus:ring-purple-500 accent-purple-500"
                                    />
                                    <span>👨‍🏫 Lecturer Expense Category (Links to Lecturer Salary & Payout Deductions)</span>
                                </label>
                            )}
                        </form>

                        {/* Categories Lists */}
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                            
                            {/* Expense Categories */}
                            <div>
                                <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <TrendingDown size={14} /> Expense Categories ({categories.filter(c => c.type === 'EXPENSE').length})
                                </h4>
                                <div className="space-y-1.5">
                                    {categories.filter(c => c.type === 'EXPENSE').map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all text-xs">
                                            {editingCatId === cat.id ? (
                                                <div className="flex flex-col gap-2 flex-1 mr-2">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="text" 
                                                            value={editingCatName} 
                                                            onChange={(e) => setEditingCatName(e.target.value)}
                                                            className="flex-1 bg-black/60 border border-blue-400 rounded-lg px-2.5 py-1 text-xs text-white outline-none font-semibold"
                                                            autoFocus
                                                        />
                                                        <button onClick={() => handleUpdateCategory(cat.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"><Check size={14} /></button>
                                                        <button onClick={() => setEditingCatId(null)} className="p-1 text-white/50 hover:bg-white/10 rounded"><X size={14} /></button>
                                                    </div>
                                                    <label className="flex items-center gap-2 text-[11px] text-purple-300">
                                                        <input 
                                                            type="checkbox"
                                                            checked={editingCatIsLecturer}
                                                            onChange={(e) => setEditingCatIsLecturer(e.target.checked)}
                                                            className="w-3 h-3 accent-purple-500"
                                                        />
                                                        <span>Lecturer Category (Deduct from Payout)</span>
                                                    </label>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white/90">{cat.name}</span>
                                                    {cat.isLecturerCategory && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                            👨‍🏫 Lecturer
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            {editingCatId !== cat.id && (
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); setEditingCatIsLecturer(Boolean(cat.isLecturerCategory)); }} 
                                                        className="p-1 text-white/40 hover:text-blue-400 hover:bg-white/10 rounded transition-colors"
                                                        title="Rename category"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteCategory(cat.id, cat.name)} 
                                                        className="p-1 text-white/40 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                                                        title="Delete category"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Income Categories */}
                            <div className="pt-2 border-t border-white/10">
                                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <TrendingUp size={14} /> Income Categories ({categories.filter(c => c.type === 'INCOME').length})
                                </h4>
                                <div className="space-y-1.5">
                                    {categories.filter(c => c.type === 'INCOME').map(cat => (
                                        <div key={cat.id} className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl border border-white/5 hover:border-white/15 transition-all text-xs">
                                            {editingCatId === cat.id ? (
                                                <div className="flex items-center gap-2 flex-1 mr-2">
                                                    <input 
                                                        type="text" 
                                                        value={editingCatName} 
                                                        onChange={(e) => setEditingCatName(e.target.value)}
                                                        className="flex-1 bg-black/60 border border-blue-400 rounded-lg px-2.5 py-1 text-xs text-white outline-none font-semibold"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleUpdateCategory(cat.id)} className="p-1 text-emerald-400 hover:bg-emerald-500/20 rounded"><Check size={14} /></button>
                                                    <button onClick={() => setEditingCatId(null)} className="p-1 text-white/50 hover:bg-white/10 rounded"><X size={14} /></button>
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-white/90">{cat.name}</span>
                                            )}

                                            {editingCatId !== cat.id && (
                                                <div className="flex items-center gap-1">
                                                    <button 
                                                        onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }} 
                                                        className="p-1 text-white/40 hover:text-blue-400 hover:bg-white/10 rounded transition-colors"
                                                        title="Rename category"
                                                    >
                                                        <Edit2 size={13} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteCategory(cat.id, cat.name)} 
                                                        className="p-1 text-white/40 hover:text-red-400 hover:bg-white/10 rounded transition-colors"
                                                        title="Delete category"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
                            <button 
                                onClick={() => setIsCategoryModalOpen(false)}
                                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Thermal Receipt Preview Modal */}
            <ThermalReceiptModal
                isOpen={receiptModalOpen}
                onClose={() => setReceiptModalOpen(false)}
                receiptData={selectedReceiptData}
                autoPrint={autoPrintDirect}
            />

            {/* A4 Daily Cash Flow Printable Sheet Modal */}
            <DailyCashFlowPrintModal
                isOpen={isPrintSheetOpen}
                onClose={() => setIsPrintSheetOpen(false)}
                selectedDate={selectedDate}
                transactions={transactions}
                summary={summary}
                onDateChange={(d) => setSelectedDate(d)}
            />

        </div>
    );
}

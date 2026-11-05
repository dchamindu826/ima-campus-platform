import React, { useState, useEffect, useMemo, useRef } from 'react';
import api from '../../api/axios';
import {
  GraduationCap,
  Users,
  Calendar,
  Wallet,
  DollarSign,
  FileText,
  Printer,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Layers,
  RefreshCw,
  Sparkles,
  CreditCard,
  Filter,
  X,
  Search,
  Download,
  BookOpen,
  Briefcase,
  Settings,
  Percent,
  Plus,
  Check,
  Sliders,
  Edit3,
  RotateCcw,
  Save,
  Calculator,
  Eye,
  Loader2,
  Trash2,
  PlusCircle,
  MinusCircle,
  ListFilter,
  ArrowRight
} from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { toast } from 'react-hot-toast';

// Smart Teacher Avatar with multi-source fallback
const TeacherAvatar = ({ image, name, size = "w-12 h-12", textSize = "text-base" }) => {
  const [imgIndex, setImgIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgIndex(0);
    setFailed(false);
  }, [image]);

  const cleanImg = useMemo(() => {
    if (!image || image === 'null' || image === 'default.png' || image === 'default-user.png' || image === 'default-tute.png') {
      return null;
    }
    return image;
  }, [image]);

  const baseUrl = useMemo(() => {
    let base = api.defaults?.baseURL || '';
    if (!base) {
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:5000';
        if (window.location.protocol === 'https:') return `https://${hostname}`;
        return `http://${hostname}:5000`;
      }
      return '';
    }
    return base.replace(/\/api\/?$/, '');
  }, []);

  const candidateUrls = useMemo(() => {
    if (!cleanImg) return [];
    if (cleanImg.startsWith('http://') || cleanImg.startsWith('https://')) {
      return [cleanImg];
    }
    const stripped = cleanImg.replace(/^\/+/, '');
    return [
      `${baseUrl}/storage/images/${stripped}`,
      `${baseUrl}/storage/documents/${stripped}`,
      `${baseUrl}/storage/icons/${stripped}`,
      `${baseUrl}/storage/users/${stripped}`,
      `${baseUrl}/api/storage/images/${stripped}`,
      `${baseUrl}/api/storage/documents/${stripped}`
    ];
  }, [cleanImg, baseUrl]);

  const handleError = () => {
    if (imgIndex < candidateUrls.length - 1) {
      setImgIndex(prev => prev + 1);
    } else {
      setFailed(true);
    }
  };

  const initials = useMemo(() => {
    if (!name) return 'L';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }, [name]);

  const gradient = useMemo(() => {
    const colors = [
      'from-rose-500 to-indigo-600',
      'from-amber-500 to-pink-600',
      'from-emerald-500 to-teal-700',
      'from-blue-500 to-cyan-600',
      'from-purple-500 to-violet-700',
      'from-fuchsia-500 to-rose-600'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
      hash = (hash + (name || '').charCodeAt(i)) % colors.length;
    }
    return colors[hash];
  }, [name]);

  if (!cleanImg || failed || candidateUrls.length === 0) {
    return (
      <div className={`${size} rounded-full bg-gradient-to-tr ${gradient} text-white font-black ${textSize} flex items-center justify-center shrink-0 shadow-md select-none border border-white/20`}>
        {initials}
      </div>
    );
  }

  return (
    <div className={`${size} rounded-full overflow-hidden bg-gray-100 dark:bg-black/40 border border-purple-500/30 shrink-0 shadow-sm relative`}>
      <img
        src={candidateUrls[imgIndex]}
        onError={handleError}
        alt=""
        crossOrigin="anonymous"
        className="w-full h-full object-cover"
      />
    </div>
  );
};

export default function TeacherSalaryPortal({ loggedInUser }) {
  const [loading, setLoading] = useState(true);
  const [businesses, setBusinesses] = useState([]);
  const [lecturers, setLecturers] = useState([]);
  const [availableBillingMonths, setAvailableBillingMonths] = useState([]);
  const [activeCycle, setActiveCycle] = useState(null);
  const [summary, setSummary] = useState({
    totalLecturers: 0,
    totalApprovedStudents: 0,
    totalFullPayments: 0,
    totalFullRevenue: 0,
    totalMonthlyPayments: 0,
    totalMonthlyRevenue: 0,
    totalUpgradePayments: 0,
    totalUpgradeRevenue: 0,
    totalInstallmentPayments: 0,
    totalInstallmentRevenue: 0,
    totalMixPayments: 0,
    totalMixRevenue: 0,
    totalAdjustedPayments: 0,
    totalAdjustedRevenue: 0,
    totalRevenue: 0
  });

  // Filters
  const [selectedBusiness, setSelectedBusiness] = useState('All');
  const [selectedBatch, setSelectedBatch] = useState('All');
  const [selectedLecturer, setSelectedLecturer] = useState('All');
  const [paymentType, setPaymentType] = useState('All');

  // Billing cycle mode: 'MONTHWISE' (1 - 30/31 of a month) | 'ALL_TIME' | 'CUSTOM'
  const [cycleMode, setCycleMode] = useState('MONTHWISE');
  const [selectedBillingMonth, setSelectedBillingMonth] = useState('2026-10'); // Default to full recent month
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // UI state
  const [expandedLecturers, setExpandedLecturers] = useState({});
  const [viewMode, setViewMode] = useState('CARDS'); // 'CARDS' | 'TABLE'
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedLecturerForPrint, setSelectedLecturerForPrint] = useState(null);
  const printRef = useRef(null);

  // Salary Setup Modal States
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [selectedSubjectForSalary, setSelectedSubjectForSalary] = useState(null);
  const [savingSalary, setSavingSalary] = useState(false);
  const [formModel, setFormModel] = useState('COMMISSION'); // 'COMMISSION' | 'FIXED'
  const [formCommissionType, setFormCommissionType] = useState('PERCENTAGE'); // 'PERCENTAGE' | 'PER_STUDENT'
  const [formCommissionRate, setFormCommissionRate] = useState(70);
  const [formPerStudentRate, setFormPerStudentRate] = useState(1500);
  const [formFixedAmount, setFormFixedAmount] = useState(100000);
  const [formWhtRate, setFormWhtRate] = useState(5); // Default 5% Withholding Tax
  const [formApplyToAllBatches, setFormApplyToAllBatches] = useState(false);
  const [formNote, setFormNote] = useState('');

  // Management Custom Payout Adjustments (Editable Duplicate Sheet)
  const [customAdjustments, setCustomAdjustments] = useState({});
  const [savingAdjustments, setSavingAdjustments] = useState(false);

  // Marked Batches per Business for Consolidated / Altogether Salary Slip: { [businessId]: { [batchId]: boolean } }
  const [markedBatches, setMarkedBatches] = useState({});

  const toggleMarkBatch = (businessId, batchId, checked) => {
    setMarkedBatches(prev => ({
      ...prev,
      [businessId]: {
        ...(prev[businessId] || {}),
        [batchId]: checked
      }
    }));
  };

  const toggleSelectAllBatches = (business, selectAll) => {
    const newBizMarks = {};
    business.batches?.forEach(b => {
      newBizMarks[b.id] = selectAll;
    });
    setMarkedBatches(prev => ({
      ...prev,
      [business.id]: newBizMarks
    }));
  };

  // Final Salary Slip Modal & Download States
  const [finalSlipModalOpen, setFinalSlipModalOpen] = useState(false);
  const [selectedFinalSlipData, setSelectedFinalSlipData] = useState(null);
  const [downloadingFinalSlipPdf, setDownloadingFinalSlipPdf] = useState(false);
  const finalSlipRef = useRef(null);
  const [finalSlipOrientation, setFinalSlipOrientation] = useState('portrait');
  const [finalSlipTheme, setFinalSlipTheme] = useState('light');
  const isLight = finalSlipTheme === 'light';

  // Pre-Slip Adjustments (Deductions, Additions, Breakdown mode)
  const [preSlipModalOpen, setPreSlipModalOpen] = useState(false);
  const [preSlipData, setPreSlipData] = useState(null);
  const [savingPreSlipAdjustments, setSavingPreSlipAdjustments] = useState(false);

  const getVoucherAdjKey = (monthKey, lecturerName, batchId, sectionType = '') => {
    const cleanLec = (lecturerName || '').trim();
    const cleanBId = batchId || 'CONSOLIDATED';
    const sec = sectionType ? `:::${sectionType}` : '';
    return `VOUCHER_ADJ:::${monthKey}:::${cleanLec}:::${cleanBId}${sec}`;
  };

  // Fetch breakdown data
  const fetchData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedBusiness !== 'All') params.businessId = selectedBusiness;
      if (selectedBatch !== 'All') params.batchId = selectedBatch;
      if (selectedLecturer !== 'All') params.lecturerName = selectedLecturer;
      if (paymentType !== 'All') params.paymentType = paymentType;

      // Billing Cycle filtering: Monthwise (1 - 30/31)
      if (cycleMode === 'MONTHWISE') {
        params.billingMonth = selectedBillingMonth;
      } else if (cycleMode === 'ALL_TIME') {
        params.dateType = 'all_time';
      } else if (cycleMode === 'CUSTOM' && startDate && endDate) {
        params.dateType = 'custom';
        params.startDate = startDate;
        params.endDate = endDate;
      }

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.get('/admin/teacher-salary/breakdown', { params });
      if (res.data) {
        setBusinesses(res.data.businesses || []);
        setLecturers(res.data.lecturers || []);
        setAvailableBillingMonths(res.data.availableBillingMonths || []);
        setActiveCycle(res.data.activeCycle || null);
        setSummary(res.data.summary || {
          totalLecturers: 0,
          totalApprovedStudents: 0,
          totalFullPayments: 0,
          totalFullRevenue: 0,
          totalMonthlyPayments: 0,
          totalMonthlyRevenue: 0,
          totalUpgradePayments: 0,
          totalUpgradeRevenue: 0,
          totalInstallmentPayments: data.summary?.totalInstallmentPayments || data.summary?.totalMixPayments || 0,
          totalInstallmentRevenue: data.summary?.totalInstallmentRevenue || data.summary?.totalMixRevenue || 0,
          totalMixPayments: data.summary?.totalInstallmentPayments || data.summary?.totalMixPayments || 0,
          totalMixRevenue: data.summary?.totalInstallmentRevenue || data.summary?.totalMixRevenue || 0,
          totalAdjustedPayments: 0,
          totalAdjustedRevenue: 0,
          totalRevenue: 0,
          totalGrossSalary: 0,
          totalWhtAmount: 0,
          totalTeacherSalary: 0,
          totalInstituteShare: 0
        });
        if (res.data.savedAdjustments) {
          setCustomAdjustments(res.data.savedAdjustments);
        }
      }
    } catch (error) {
      console.error("Error fetching teacher salary breakdown:", error);
      toast.error("Failed to load teacher salary breakdown.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBusiness, selectedBatch, selectedLecturer, paymentType, cycleMode, selectedBillingMonth, startDate, endDate]);

  // Helper to compute live auto-calculated values for editable duplicate
  const getSubjectAdjustedData = (subject, batchId, lecturerName) => {
    const monthKey = selectedBillingMonth || activeCycle?.monthKey || 'default';
    const isPaperSuffix = (subject.classType === 2 || subject.isPaperClass) ? ':::PAPER' : '';
    const key = `${monthKey}:::${batchId}:::${subject.normalizedSubName || subject.name}${isPaperSuffix}`;
    const adj = customAdjustments[key];

    // Compute unit rates based on real system values
    const monthlyRate = subject.monthlyCount > 0
      ? (subject.monthlyAmount / subject.monthlyCount)
      : (subject.totalAmount && subject.totalApproved ? subject.totalAmount / subject.totalApproved : 1000);

    const fullRate = subject.fullCount > 0
      ? (subject.fullAmount / subject.fullCount)
      : monthlyRate;

    const upgradeRate = subject.upgradeCount > 0
      ? (subject.upgradeAmount / subject.upgradeCount)
      : monthlyRate;

    const installmentRate = (subject.installmentCount > 0
      ? (subject.installmentAmount / subject.installmentCount)
      : (subject.mixCount > 0 ? (subject.mixAmount / subject.mixCount) : monthlyRate));

    const mixRate = installmentRate;

    const adjustedRate = subject.adjustedCount > 0
      ? (subject.adjustedAmount / subject.adjustedCount)
      : (monthlyRate * 0.5);

    const monthlyCount = adj && adj.monthlyCount !== undefined && adj.monthlyCount !== ''
      ? Number(adj.monthlyCount)
      : subject.monthlyCount;

    const fullCount = adj && adj.fullCount !== undefined && adj.fullCount !== ''
      ? Number(adj.fullCount)
      : subject.fullCount;

    const upgradeCount = adj && adj.upgradeCount !== undefined && adj.upgradeCount !== ''
      ? Number(adj.upgradeCount)
      : (subject.upgradeCount || 0);

    const installmentCount = adj && adj.installmentCount !== undefined && adj.installmentCount !== ''
      ? Number(adj.installmentCount)
      : (adj && adj.mixCount !== undefined && adj.mixCount !== '' ? Number(adj.mixCount) : (subject.installmentCount || subject.mixCount || 0));

    const mixCount = installmentCount;

    const adjustedCount = adj && adj.adjustedCount !== undefined && adj.adjustedCount !== ''
      ? Number(adj.adjustedCount)
      : (subject.adjustedCount || 0);

    const monthlyAmount = Math.round(monthlyCount * monthlyRate);
    const fullAmount = Math.round(fullCount * fullRate);
    const upgradeAmount = Math.round(upgradeCount * upgradeRate);
    const installmentAmount = Math.round(installmentCount * installmentRate);
    const mixAmount = installmentAmount;
    const adjustedAmount = Math.round(adjustedCount * adjustedRate);

    const totalApproved = monthlyCount + fullCount + upgradeCount + installmentCount + adjustedCount;
    const totalAmount = monthlyAmount + fullAmount + upgradeAmount + installmentAmount + adjustedAmount;

    // Calculate Salary dynamically based on Subject Salary Model
    let grossSalary = 0;
    const rule = subject.salaryConfig;
    if (rule) {
      if (rule.model === 'FIXED') {
        grossSalary = Math.round(Number(rule.fixedAmount) || 0);
      } else if (rule.model === 'COMMISSION') {
        if (rule.commissionType === 'PER_STUDENT') {
          grossSalary = Math.round(totalApproved * (Number(rule.perStudentRate) || 0));
        } else {
          grossSalary = Math.round((totalAmount * (Number(rule.commissionRate) || 0)) / 100);
        }
      }
    } else {
      const ratio = (subject.totalAmount > 0 && subject.grossSalary > 0) ? (subject.grossSalary / subject.totalAmount) : 0.5;
      grossSalary = Math.round(totalAmount * ratio);
    }

    const whtRate = Number(rule?.whtRate ?? subject.whtRate ?? 0) || 0;
    const whtAmount = whtRate > 0 ? Math.round((grossSalary * whtRate) / 100) : 0;
    const teacherSalary = Math.max(0, grossSalary - whtAmount);
    const instituteShare = Math.max(0, totalAmount - grossSalary);

    const isModified = adj !== undefined && (
      adj.monthlyCount !== subject.monthlyCount ||
      adj.fullCount !== subject.fullCount ||
      adj.upgradeCount !== (subject.upgradeCount || 0) ||
      (adj.installmentCount !== undefined ? adj.installmentCount !== (subject.installmentCount || 0) : (adj.mixCount !== undefined && adj.mixCount !== (subject.installmentCount || subject.mixCount || 0))) ||
      adj.adjustedCount !== (subject.adjustedCount || 0)
    );

    return {
      key,
      monthlyCount,
      monthlyAmount,
      fullCount,
      fullAmount,
      upgradeCount,
      upgradeAmount,
      installmentCount,
      installmentAmount,
      mixCount,
      mixAmount,
      adjustedCount,
      adjustedAmount,
      totalApproved,
      totalAmount,
      grossSalary,
      whtRate,
      whtAmount,
      teacherSalary,
      instituteShare,
      isModified
    };
  };

  const handleCountChange = (subject, batchId, field, val) => {
    const monthKey = selectedBillingMonth || activeCycle?.monthKey || 'default';
    const isPaperSuffix = (subject.classType === 2 || subject.isPaperClass) ? ':::PAPER' : '';
    const key = `${monthKey}:::${batchId}:::${subject.normalizedSubName || subject.name}${isPaperSuffix}`;
    const num = val === '' ? 0 : Math.max(0, parseInt(val) || 0);

    setCustomAdjustments(prev => {
      const existing = prev[key] || {
        monthlyCount: subject.monthlyCount,
        fullCount: subject.fullCount,
        upgradeCount: subject.upgradeCount || 0,
        installmentCount: subject.installmentCount || subject.mixCount || 0,
        mixCount: subject.installmentCount || subject.mixCount || 0,
        adjustedCount: subject.adjustedCount || 0
      };
      return {
        ...prev,
        [key]: {
          ...existing,
          [field]: num
        }
      };
    });
  };

  const handleResetBatchAdjustments = (batch, targetSubjects = null) => {
    const monthKey = selectedBillingMonth || activeCycle?.monthKey || 'default';
    const list = targetSubjects || batch.subjects || [];
    setCustomAdjustments(prev => {
      const updated = { ...prev };
      list.forEach(s => {
        const isPaperSuffix = (s.classType === 2 || s.isPaperClass) ? ':::PAPER' : '';
        const key = `${monthKey}:::${batch.id}:::${s.normalizedSubName || s.name}${isPaperSuffix}`;
        delete updated[key];
      });
      return updated;
    });
    toast.success(`Reset ${batch.name} counts to real system values.`);
  };

  const handleSaveAdjustments = async () => {
    try {
      setSavingAdjustments(true);
      const monthKey = selectedBillingMonth || activeCycle?.monthKey || 'default';
      await api.post('/admin/teacher-salary/adjustments', {
        billingMonth: monthKey,
        adjustments: customAdjustments
      });
      toast.success("Payout adjustments saved successfully!");
    } catch (err) {
      console.error("Error saving adjustments:", err);
      toast.error("Failed to save payout adjustments.");
    } finally {
      setSavingAdjustments(false);
    }
  };

  // Final Salary Slip Modal & Download Handlers
  const handleOpenFinalSlipModal = (data) => {
    setSelectedFinalSlipData(data);
    setFinalSlipModalOpen(true);
  };

  const handleOpenPreSlipModal = (data) => {
    const monthKey = selectedBillingMonth || activeCycle?.monthKey || 'default';
    const batchId = data.isConsolidated ? `MULTI-${data.business?.id}` : data.batch?.id;
    const voucherKey = getVoucherAdjKey(monthKey, data.lecturer?.name, batchId, data.sectionType);
    const savedConfig = customAdjustments[voucherKey] || {};

    const initialDeductions = (savedConfig.deductions && Array.isArray(savedConfig.deductions))
      ? JSON.parse(JSON.stringify(savedConfig.deductions))
      : (data.deductions ? JSON.parse(JSON.stringify(data.deductions)) : []);

    const initialAdditions = (savedConfig.additions && Array.isArray(savedConfig.additions))
      ? JSON.parse(JSON.stringify(savedConfig.additions))
      : (data.additions ? JSON.parse(JSON.stringify(data.additions)) : []);

    const initialManualBatches = (savedConfig.manualBatches && Array.isArray(savedConfig.manualBatches))
      ? JSON.parse(JSON.stringify(savedConfig.manualBatches))
      : (data.manualBatches ? JSON.parse(JSON.stringify(data.manualBatches)) : []);

    const initialMode = savedConfig.breakdownMode || data.breakdownMode || 'DETAILED';

    // Ensure base items exclude any previously added manual batch rows
    const cleanBaseAdjSubjects = (data.baseAdjSubjects || data.adjSubjects || []).filter(item => !item.subject?.isManualBatch);
    const cleanBaseSubtotalAdj = data.baseSubtotalAdj || cleanBaseAdjSubjects.reduce((acc, { adj }) => {
      acc.monthlyCount = (acc.monthlyCount || 0) + (adj?.monthlyCount || 0);
      acc.monthlyAmount = (acc.monthlyAmount || 0) + (adj?.monthlyAmount || 0);
      acc.fullCount = (acc.fullCount || 0) + (adj?.fullCount || 0);
      acc.fullAmount = (acc.fullAmount || 0) + (adj?.fullAmount || 0);
      acc.upgradeCount = (acc.upgradeCount || 0) + (adj?.upgradeCount || 0);
      acc.upgradeAmount = (acc.upgradeAmount || 0) + (adj?.upgradeAmount || 0);
      acc.installmentCount = (acc.installmentCount || 0) + (adj?.installmentCount ?? adj?.mixCount ?? 0);
      acc.installmentAmount = (acc.installmentAmount || 0) + (adj?.installmentAmount ?? adj?.mixAmount ?? 0);
      acc.mixCount = (acc.mixCount || 0) + (adj?.installmentCount ?? adj?.mixCount ?? 0);
      acc.mixAmount = (acc.mixAmount || 0) + (adj?.installmentAmount ?? adj?.mixAmount ?? 0);
      acc.adjustedCount = (acc.adjustedCount || 0) + (adj?.adjustedCount || 0);
      acc.adjustedAmount = (acc.adjustedAmount || 0) + (adj?.adjustedAmount || 0);
      acc.totalApproved = (acc.totalApproved || 0) + (adj?.totalApproved || 0);
      acc.totalAmount = (acc.totalAmount || 0) + (adj?.totalAmount || 0);
      acc.grossSalary = (acc.grossSalary || 0) + (adj?.grossSalary || 0);
      acc.whtAmount = (acc.whtAmount || 0) + (adj?.whtAmount || 0);
      acc.teacherSalary = (acc.teacherSalary || 0) + (adj?.teacherSalary || 0);
      acc.instituteShare = (acc.instituteShare || 0) + (adj?.instituteShare || 0);
      return acc;
    }, {
      monthlyCount: 0, monthlyAmount: 0,
      fullCount: 0, fullAmount: 0,
      upgradeCount: 0, upgradeAmount: 0,
      installmentCount: 0, installmentAmount: 0,
      mixCount: 0, mixAmount: 0,
      adjustedCount: 0, adjustedAmount: 0,
      totalApproved: 0, totalAmount: 0,
      grossSalary: 0, whtAmount: 0, teacherSalary: 0, instituteShare: 0
    });

    setPreSlipData({
      ...data,
      baseAdjSubjects: cleanBaseAdjSubjects,
      baseSubtotalAdj: cleanBaseSubtotalAdj,
      voucherKey,
      deductions: initialDeductions,
      additions: initialAdditions,
      manualBatches: initialManualBatches,
      breakdownMode: initialMode
    });
    setPreSlipModalOpen(true);
  };

  const handleAddPreSlipDeduction = (presetDesc = '') => {
    if (!preSlipData) return;
    setPreSlipData(prev => ({
      ...prev,
      deductions: [
        ...(prev.deductions || []),
        { id: `d-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, description: presetDesc, amount: '' }
      ]
    }));
  };

  const handleUpdatePreSlipDeduction = (index, field, value) => {
    if (!preSlipData) return;
    setPreSlipData(prev => {
      const updated = [...(prev.deductions || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, deductions: updated };
    });
  };

  const handleRemovePreSlipDeduction = (index) => {
    if (!preSlipData) return;
    setPreSlipData(prev => {
      const updated = [...(prev.deductions || [])];
      updated.splice(index, 1);
      return { ...prev, deductions: updated };
    });
  };

  const handleAddPreSlipAddition = (presetDesc = '') => {
    if (!preSlipData) return;
    setPreSlipData(prev => ({
      ...prev,
      additions: [
        ...(prev.additions || []),
        { id: `a-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, description: presetDesc, studentCount: '', amount: '' }
      ]
    }));
  };

  const handleUpdatePreSlipAddition = (index, field, value) => {
    if (!preSlipData) return;
    setPreSlipData(prev => {
      const updated = [...(prev.additions || [])];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, additions: updated };
    });
  };

  const handleRemovePreSlipAddition = (index) => {
    if (!preSlipData) return;
    setPreSlipData(prev => {
      const updated = [...(prev.additions || [])];
      updated.splice(index, 1);
      return { ...prev, additions: updated };
    });
  };

  const handleAddPreSlipManualBatch = (defaultBatchName = '') => {
    if (!preSlipData) return;
    setPreSlipData(prev => ({
      ...prev,
      manualBatches: [
        ...(prev.manualBatches || []),
        {
          id: `mb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          batchName: defaultBatchName || '',
          subjectName: 'Class Remuneration',
          studentCount: '',
          grossAmount: '',
          whtRate: 0,
          whtAmount: '',
          netAmount: ''
        }
      ]
    }));
  };

  const handleUpdatePreSlipManualBatch = (index, field, value) => {
    if (!preSlipData) return;
    setPreSlipData(prev => {
      const updated = [...(prev.manualBatches || [])];
      const item = { ...updated[index], [field]: value };

      const gross = parseFloat(item.grossAmount) || 0;
      
      if (field === 'grossAmount' || field === 'whtRate') {
        const rate = parseFloat(item.whtRate) || 0;
        const wht = rate > 0 ? Math.round((gross * rate) / 100) : 0;
        item.whtAmount = wht > 0 ? wht : '';
        item.netAmount = Math.max(0, gross - wht);
      } else if (field === 'whtAmount') {
        const wht = parseFloat(item.whtAmount) || 0;
        item.whtRate = (gross > 0 && wht > 0) ? Math.round((wht / gross) * 1000) / 10 : 0;
        item.netAmount = Math.max(0, gross - wht);
      } else {
        const wht = parseFloat(item.whtAmount) || 0;
        item.netAmount = Math.max(0, gross - wht);
      }

      updated[index] = item;
      return { ...prev, manualBatches: updated };
    });
  };

  const handleRemovePreSlipManualBatch = (index) => {
    if (!preSlipData) return;
    setPreSlipData(prev => {
      const updated = [...(prev.manualBatches || [])];
      updated.splice(index, 1);
      return { ...prev, manualBatches: updated };
    });
  };

  const handleSavePreSlipAdjustmentsOnly = async () => {
    if (!preSlipData) return;
    try {
      setSavingPreSlipAdjustments(true);
      const cleanDeductions = (preSlipData.deductions || [])
        .filter(d => (d.description && d.description.trim()) || Number(d.amount) > 0)
        .map(d => ({ ...d, amount: parseFloat(d.amount) || 0 }));

      const cleanAdditions = (preSlipData.additions || [])
        .filter(a => (a.description && a.description.trim()) || Number(a.amount) > 0)
        .map(a => ({
          ...a,
          amount: parseFloat(a.amount) || 0,
          studentCount: a.studentCount !== '' && a.studentCount !== undefined ? parseInt(a.studentCount) : null
        }));

      const cleanManualBatches = (preSlipData.manualBatches || [])
        .filter(b => (b.batchName && b.batchName.trim()) || Number(b.grossAmount) > 0 || Number(b.studentCount) > 0)
        .map(b => ({
          ...b,
          batchName: (b.batchName || '').trim(),
          subjectName: (b.subjectName || '').trim() || 'Class Remuneration',
          studentCount: parseInt(b.studentCount) || 0,
          grossAmount: parseFloat(b.grossAmount) || 0,
          whtRate: parseFloat(b.whtRate) || 0,
          whtAmount: parseFloat(b.whtAmount) || 0,
          netAmount: parseFloat(b.netAmount) || (parseFloat(b.grossAmount) || 0) - (parseFloat(b.whtAmount) || 0)
        }));

      const monthKey = selectedBillingMonth || activeCycle?.monthKey || 'default';
      const batchId = preSlipData.isConsolidated ? `MULTI-${preSlipData.business?.id}` : preSlipData.batch?.id;
      const voucherKey = preSlipData.voucherKey || getVoucherAdjKey(monthKey, preSlipData.lecturer?.name, batchId, preSlipData.sectionType);

      const voucherPayload = {
        deductions: cleanDeductions,
        additions: cleanAdditions,
        manualBatches: cleanManualBatches,
        breakdownMode: preSlipData.breakdownMode || 'DETAILED'
      };

      const updatedAllAdjustments = {
        ...customAdjustments,
        [voucherKey]: voucherPayload
      };

      setCustomAdjustments(updatedAllAdjustments);

      await api.post('/admin/teacher-salary/adjustments', {
        billingMonth: monthKey,
        adjustments: updatedAllAdjustments
      });

      toast.success("Voucher adjustments (deductions, additions & manual batches) saved!");
    } catch (err) {
      console.error("Error saving pre-slip adjustments:", err);
      toast.error("Failed to save adjustments.");
    } finally {
      setSavingPreSlipAdjustments(false);
    }
  };

  const handleApplyPreSlipAndPreview = () => {
    if (!preSlipData) return;
    const cleanDeductions = (preSlipData.deductions || [])
      .filter(d => (d.description && d.description.trim()) || Number(d.amount) > 0)
      .map(d => ({ ...d, amount: parseFloat(d.amount) || 0 }));

    const cleanAdditions = (preSlipData.additions || [])
      .filter(a => (a.description && a.description.trim()) || Number(a.amount) > 0)
      .map(a => ({
        ...a,
        amount: parseFloat(a.amount) || 0,
        studentCount: a.studentCount !== '' && a.studentCount !== undefined ? parseInt(a.studentCount) : null
      }));

    const cleanManualBatches = (preSlipData.manualBatches || [])
      .filter(b => (b.batchName && b.batchName.trim()) || Number(b.grossAmount) > 0 || Number(b.studentCount) > 0)
      .map(b => ({
        ...b,
        batchName: (b.batchName || '').trim(),
        subjectName: (b.subjectName || '').trim() || 'Class Remuneration',
        studentCount: parseInt(b.studentCount) || 0,
        grossAmount: parseFloat(b.grossAmount) || 0,
        whtRate: parseFloat(b.whtRate) || 0,
        whtAmount: parseFloat(b.whtAmount) || 0,
        netAmount: parseFloat(b.netAmount) || (parseFloat(b.grossAmount) || 0) - (parseFloat(b.whtAmount) || 0)
      }));

    const cleanBaseAdjSubjects = (preSlipData.baseAdjSubjects || preSlipData.adjSubjects || []).filter(item => !item.subject?.isManualBatch);
    const cleanBaseSubtotalAdj = preSlipData.baseSubtotalAdj || cleanBaseAdjSubjects.reduce((acc, { adj }) => {
      acc.monthlyCount = (acc.monthlyCount || 0) + (adj?.monthlyCount || 0);
      acc.monthlyAmount = (acc.monthlyAmount || 0) + (adj?.monthlyAmount || 0);
      acc.fullCount = (acc.fullCount || 0) + (adj?.fullCount || 0);
      acc.fullAmount = (acc.fullAmount || 0) + (adj?.fullAmount || 0);
      acc.upgradeCount = (acc.upgradeCount || 0) + (adj?.upgradeCount || 0);
      acc.upgradeAmount = (acc.upgradeAmount || 0) + (adj?.upgradeAmount || 0);
      acc.installmentCount = (acc.installmentCount || 0) + (adj?.installmentCount ?? adj?.mixCount ?? 0);
      acc.installmentAmount = (acc.installmentAmount || 0) + (adj?.installmentAmount ?? adj?.mixAmount ?? 0);
      acc.mixCount = (acc.mixCount || 0) + (adj?.installmentCount ?? adj?.mixCount ?? 0);
      acc.mixAmount = (acc.mixAmount || 0) + (adj?.installmentAmount ?? adj?.mixAmount ?? 0);
      acc.adjustedCount = (acc.adjustedCount || 0) + (adj?.adjustedCount || 0);
      acc.adjustedAmount = (acc.adjustedAmount || 0) + (adj?.adjustedAmount || 0);
      acc.totalApproved = (acc.totalApproved || 0) + (adj?.totalApproved || 0);
      acc.totalAmount = (acc.totalAmount || 0) + (adj?.totalAmount || 0);
      acc.grossSalary = (acc.grossSalary || 0) + (adj?.grossSalary || 0);
      acc.whtAmount = (acc.whtAmount || 0) + (adj?.whtAmount || 0);
      acc.teacherSalary = (acc.teacherSalary || 0) + (adj?.teacherSalary || 0);
      acc.instituteShare = (acc.instituteShare || 0) + (adj?.instituteShare || 0);
      return acc;
    }, {
      monthlyCount: 0, monthlyAmount: 0,
      fullCount: 0, fullAmount: 0,
      upgradeCount: 0, upgradeAmount: 0,
      installmentCount: 0, installmentAmount: 0,
      mixCount: 0, mixAmount: 0,
      adjustedCount: 0, adjustedAmount: 0,
      totalApproved: 0, totalAmount: 0,
      grossSalary: 0, whtAmount: 0, teacherSalary: 0, instituteShare: 0
    });

    const manualAdjRows = cleanManualBatches.map(b => ({
      subject: {
        id: `manual-${b.id}`,
        name: b.subjectName || 'Class Remuneration',
        isManualBatch: true
      },
      adj: {
        monthlyCount: 0,
        fullCount: 0,
        upgradeCount: 0,
        installmentCount: 0,
        mixCount: 0,
        adjustedCount: 0,
        totalApproved: parseInt(b.studentCount) || 0,
        grossSalary: parseFloat(b.grossAmount) || 0,
        whtRate: parseFloat(b.whtRate) || 0,
        whtAmount: parseFloat(b.whtAmount) || 0,
        teacherSalary: parseFloat(b.netAmount) || (parseFloat(b.grossAmount) || 0) - (parseFloat(b.whtAmount) || 0),
        isModified: true
      },
      batchId: b.batchId || `MANUAL-${b.id}`,
      batchName: b.batchName || 'Manual Batch'
    }));

    const finalSubtotalAdj = {
      ...cleanBaseSubtotalAdj,
      totalApproved: cleanBaseSubtotalAdj.totalApproved + cleanManualBatches.reduce((s, b) => s + (parseInt(b.studentCount) || 0), 0),
      grossSalary: cleanBaseSubtotalAdj.grossSalary + cleanManualBatches.reduce((s, b) => s + (parseFloat(b.grossAmount) || 0), 0),
      whtAmount: cleanBaseSubtotalAdj.whtAmount + cleanManualBatches.reduce((s, b) => s + (parseFloat(b.whtAmount) || 0), 0),
      teacherSalary: cleanBaseSubtotalAdj.teacherSalary + cleanManualBatches.reduce((s, b) => s + (parseFloat(b.netAmount) || (parseFloat(b.grossAmount) || 0) - (parseFloat(b.whtAmount) || 0)), 0)
    };

    const monthKey = selectedBillingMonth || activeCycle?.monthKey || 'default';
    const batchId = preSlipData.isConsolidated ? `MULTI-${preSlipData.business?.id}` : preSlipData.batch?.id;
    const voucherKey = preSlipData.voucherKey || getVoucherAdjKey(monthKey, preSlipData.lecturer?.name, batchId, preSlipData.sectionType);

    const voucherPayload = {
      deductions: cleanDeductions,
      additions: cleanAdditions,
      manualBatches: cleanManualBatches,
      breakdownMode: preSlipData.breakdownMode || 'DETAILED'
    };

    setCustomAdjustments(prev => ({
      ...prev,
      [voucherKey]: voucherPayload
    }));

    // Non-blocking auto-save to backend
    api.post('/admin/teacher-salary/adjustments', {
      billingMonth: monthKey,
      adjustments: {
        ...customAdjustments,
        [voucherKey]: voucherPayload
      }
    }).catch(e => console.warn("Background adjustments save:", e));

    const finalData = {
      ...preSlipData,
      baseAdjSubjects: cleanBaseAdjSubjects,
      baseSubtotalAdj: cleanBaseSubtotalAdj,
      adjSubjects: [...cleanBaseAdjSubjects, ...manualAdjRows],
      subtotalAdj: finalSubtotalAdj,
      deductions: cleanDeductions,
      additions: cleanAdditions,
      manualBatches: cleanManualBatches,
      breakdownMode: preSlipData.breakdownMode || 'DETAILED'
    };

    setSelectedFinalSlipData(finalData);
    setPreSlipModalOpen(false);
    setFinalSlipModalOpen(true);
  };

  const handleApplyPreSlipAndDownload = () => {
    if (!preSlipData) return;
    handleApplyPreSlipAndPreview();
    setTimeout(() => {
      handleDownloadFinalSlipPdf();
    }, 450);
  };

  const handleDownloadFinalSlipPdf = async () => {
    if (!finalSlipRef.current || !selectedFinalSlipData) return;
    try {
      setDownloadingFinalSlipPdf(true);
      const isLandscape = finalSlipOrientation === 'landscape';
      const toastId = toast.loading("Generating high-resolution Salary Slip PDF...");
      await new Promise(r => setTimeout(r, 150));

      const element = finalSlipRef.current;
      const imgData = await toPng(element, {
        quality: 1,
        pixelRatio: 2.5,
        backgroundColor: finalSlipTheme === 'light' ? '#ffffff' : '#0f172a',
        cacheBust: true,
        style: {
          borderRadius: '0px',
          margin: '0px'
        }
      });

      const pdf = new jsPDF({
        orientation: isLandscape ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = isLandscape ? 297 : 210;
      const pageHeight = isLandscape ? 210 : 297;
      const margin = 10;
      const printableWidth = pageWidth - (margin * 2);

      const img = new Image();
      img.src = imgData;
      await new Promise(resolve => { img.onload = resolve; });

      const imgRatio = img.height / img.width;
      let renderWidth = printableWidth;
      let renderHeight = printableWidth * imgRatio;

      if (renderHeight > (pageHeight - (margin * 2))) {
        renderHeight = pageHeight - (margin * 2);
        renderWidth = renderHeight / imgRatio;
      }

      const xPos = margin + ((printableWidth - renderWidth) / 2);
      const yPos = margin;

      pdf.addImage(imgData, 'PNG', xPos, yPos, renderWidth, renderHeight);

      const cleanLecName = (selectedFinalSlipData.lecturer?.name || 'Lecturer').replace(/[^a-zA-Z0-9]/g, '_');
      const cleanBatchName = selectedFinalSlipData.isConsolidated
        ? `Consolidated_${selectedFinalSlipData.batchesCount || 'Multi'}_Batches`
        : (selectedFinalSlipData.batch?.name || 'Batch').replace(/[^a-zA-Z0-9]/g, '_');
      const monthStr = selectedBillingMonth || activeCycle?.monthKey || 'Month';
      const filename = `Salary_Slip_${cleanLecName}_${cleanBatchName}_${monthStr}.pdf`;

      pdf.save(filename);
      toast.dismiss(toastId);
      toast.success("Final Salary Slip downloaded successfully!");
    } catch (err) {
      console.error("Error downloading salary slip PDF:", err);
      toast.error("Failed to generate PDF slip.");
    } finally {
      setDownloadingFinalSlipPdf(false);
    }
  };

  const handleQuickDownloadSlip = (data) => {
    handleOpenPreSlipModal(data);
  };

  // Consolidated / Altogether Salary Slip Handlers
  const handleOpenConsolidatedFinalSlipModal = (business, lecturer, markedBatchList, consolidatedAdjSubjects, consolidatedSubtotal) => {
    if (!markedBatchList || markedBatchList.length === 0) {
      toast.error("Please mark at least one batch to generate altogether salary slip.");
      return;
    }

    const batchNames = markedBatchList.map(b => b.name).join(', ');

    const consolidatedData = {
      isConsolidated: true,
      lecturer,
      business,
      batch: {
        id: `MULTI-${business.id}`,
        name: batchNames
      },
      batchesCount: markedBatchList.length,
      markedBatches: markedBatchList,
      adjSubjects: consolidatedAdjSubjects,
      subtotalAdj: consolidatedSubtotal,
      salaryDiff: 0
    };

    handleOpenPreSlipModal(consolidatedData);
  };

  const handleQuickDownloadConsolidatedSlip = (business, lecturer, markedBatchList, consolidatedAdjSubjects, consolidatedSubtotal) => {
    handleOpenConsolidatedFinalSlipModal(business, lecturer, markedBatchList, consolidatedAdjSubjects, consolidatedSubtotal);
  };

  // Stepper handlers for Monthwise navigation
  const handlePrevMonth = () => {
    if (!availableBillingMonths || availableBillingMonths.length === 0) return;
    const currentIndex = availableBillingMonths.findIndex(m => m.key === selectedBillingMonth);
    // Since availableBillingMonths is sorted descending (Nov, Oct, Sep, Aug...),
    // Prev month is at currentIndex + 1
    if (currentIndex >= 0 && currentIndex < availableBillingMonths.length - 1) {
      setSelectedBillingMonth(availableBillingMonths[currentIndex + 1].key);
    }
  };

  const handleNextMonth = () => {
    if (!availableBillingMonths || availableBillingMonths.length === 0) return;
    const currentIndex = availableBillingMonths.findIndex(m => m.key === selectedBillingMonth);
    // Next month is at currentIndex - 1
    if (currentIndex > 0) {
      setSelectedBillingMonth(availableBillingMonths[currentIndex - 1].key);
    }
  };

  // Available batches based on selected business
  const availableBatches = useMemo(() => {
    const batchesMap = new Map();
    lecturers.forEach(l => {
      l.businesses?.forEach(b => {
        if (selectedBusiness === 'All' || String(b.id) === String(selectedBusiness)) {
          b.batches?.forEach(batch => {
            batchesMap.set(batch.id, { id: batch.id, name: batch.name });
          });
        }
      });
    });
    return Array.from(batchesMap.values());
  }, [lecturers, selectedBusiness]);

  // Filtered lecturers based on search query
  const filteredLecturers = useMemo(() => {
    if (!searchQuery.trim()) return lecturers;
    const q = searchQuery.toLowerCase().trim();
    return lecturers.filter(l => {
      if (l.name.toLowerCase().includes(q)) return true;
      return l.businesses?.some(b =>
        b.name.toLowerCase().includes(q) ||
        b.batches?.some(bt =>
          bt.name.toLowerCase().includes(q) ||
          bt.subjects?.some(s => s.name.toLowerCase().includes(q))
        )
      );
    });
  }, [lecturers, searchQuery]);

  // Toggle expand/collapse
  const toggleExpand = (lecturerId) => {
    setExpandedLecturers(prev => ({
      ...prev,
      [lecturerId]: !prev[lecturerId]
    }));
  };

  const expandAll = () => {
    const all = {};
    filteredLecturers.forEach(l => { all[l.id] = true; });
    setExpandedLecturers(all);
  };

  const collapseAll = () => {
    setExpandedLecturers({});
  };

  // Export CSV
  const handleExportCSV = () => {
    try {
      const rows = [
        [
          'Lecturer Name',
          'Business',
          'Batch',
          'Subject / Course',
          'Payment Plan',
          'Monthly Students',
          'Monthly Revenue (LKR)',
          'Full Students',
          'Full Revenue (LKR)',
          'Upgrade Students',
          'Upgrade Revenue (LKR)',
          'Installment Students',
          'Installment Revenue (LKR)',
          'Adjusted Count',
          'Adjusted Value (LKR)',
          'Total Paid Students',
          'Total Revenue (LKR)',
          'Salary Model',
          'Gross Salary (LKR)',
          'WHT Rate (%)',
          'WHT Deduction (LKR)',
          'Net Teacher Salary (LKR)',
          'Institute Share (LKR)'
        ]
      ];

      filteredLecturers.forEach(l => {
        l.businesses?.forEach(b => {
          b.batches?.forEach(bt => {
            bt.subjects?.forEach(s => {
              const modelLabel = s.salaryModel === 'COMMISSION' 
                ? (s.salaryConfig?.commissionType === 'PER_STUDENT' 
                    ? `Commission (Rs. ${s.salaryConfig.perStudentRate}/student)` 
                    : `Commission (${s.salaryConfig?.commissionRate || 0}%)`)
                : (s.salaryModel === 'FIXED' 
                    ? `Fixed (Rs. ${Number(s.salaryConfig?.fixedAmount || 0).toLocaleString()})` 
                    : 'Not Configured');

              rows.push([
                `"${l.name.replace(/"/g, '""')}"`,
                `"${b.name.replace(/"/g, '""')}"`,
                `"${bt.name.replace(/"/g, '""')}"`,
                `"${s.name.replace(/"/g, '""')}"`,
                `"${(s.groupName || s.groupType).replace(/"/g, '""')}"`,
                s.monthlyCount,
                Math.round(s.monthlyAmount || 0),
                s.fullCount,
                Math.round(s.fullAmount || 0),
                s.upgradeCount || 0,
                Math.round(s.upgradeAmount || 0),
                s.installmentCount || s.mixCount || 0,
                Math.round(s.installmentAmount || s.mixAmount || 0),
                s.adjustedCount || 0,
                Math.round(s.adjustedAmount || 0),
                s.totalApproved,
                Math.round(s.totalAmount),
                `"${modelLabel}"`,
                Math.round(s.grossSalary || s.teacherSalary || 0),
                s.whtRate || 0,
                Math.round(s.whtAmount || 0),
                Math.round(s.teacherSalary || 0),
                Math.round(s.instituteShare || 0)
              ]);
            });
          });
        });
      });

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(',')).join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Teacher_Salary_${selectedBillingMonth || 'Cycle'}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV export downloaded successfully!");
    } catch (e) {
      console.error("Export error:", e);
      toast.error("Failed to export CSV.");
    }
  };

  // Open Salary Setup Modal
  const openSalarySetup = (subject, batch, business, lecturer) => {
    setSelectedSubjectForSalary({ subject, batch, business, lecturer });
    const cfg = subject.salaryConfig;
    if (cfg) {
      setFormModel(cfg.model || 'COMMISSION');
      setFormCommissionType(cfg.commissionType || 'PERCENTAGE');
      setFormCommissionRate(cfg.commissionRate !== undefined ? cfg.commissionRate : 70);
      setFormPerStudentRate(cfg.perStudentRate !== undefined ? cfg.perStudentRate : 1500);
      setFormFixedAmount(cfg.fixedAmount !== undefined ? cfg.fixedAmount : 100000);
      setFormWhtRate(cfg.whtRate !== undefined ? cfg.whtRate : 5);
      setFormNote(cfg.note || '');
    } else {
      setFormModel('COMMISSION');
      setFormCommissionType('PERCENTAGE');
      setFormCommissionRate(70);
      setFormPerStudentRate(1500);
      setFormFixedAmount(100000);
      setFormWhtRate(5);
      setFormNote('');
    }
    setFormApplyToAllBatches(false);
    setSalaryModalOpen(true);
  };

  // Save Salary Config
  const handleSaveSalaryConfig = async () => {
    if (!selectedSubjectForSalary) return;
    const { subject, batch, lecturer } = selectedSubjectForSalary;
    try {
      setSavingSalary(true);
      const ruleKey = subject.salaryRuleKey || `${batch.id}:::${lecturer.name}:::${subject.normalizedSubName || subject.name.toUpperCase()}`;
      const ruleData = {
        model: formModel,
        commissionType: formCommissionType,
        commissionRate: parseFloat(formCommissionRate) || 0,
        perStudentRate: parseFloat(formPerStudentRate) || 0,
        fixedAmount: parseFloat(formFixedAmount) || 0,
        whtRate: Math.max(0, parseFloat(formWhtRate) || 0),
        batchId: batch.id,
        batchName: batch.name,
        subjectName: subject.name,
        normalizedSubName: subject.normalizedSubName || subject.name.toUpperCase(),
        lecturerName: lecturer.name,
        note: formNote
      };

      const res = await api.post('/admin/teacher-salary/config', {
        ruleKey,
        rule: ruleData,
        applyToAllBatches: formApplyToAllBatches
      });

      if (res.data?.success) {
        toast.success("Teacher salary configuration saved!");
        setSalaryModalOpen(false);
        await fetchData();
      }
    } catch (err) {
      console.error("Error saving salary config:", err);
      toast.error("Failed to save teacher salary configuration.");
    } finally {
      setSavingSalary(false);
    }
  };

  // Reset / Delete Salary Config
  const handleResetSalaryConfig = async () => {
    if (!selectedSubjectForSalary) return;
    const { subject, batch, lecturer } = selectedSubjectForSalary;
    try {
      setSavingSalary(true);
      const ruleKey = subject.salaryRuleKey || `${batch.id}:::${lecturer.name}:::${subject.normalizedSubName || subject.name.toUpperCase()}`;
      const res = await api.post('/admin/teacher-salary/config', {
        ruleKey,
        rule: null
      });

      if (res.data?.success) {
        toast.success("Salary configuration reset to default!");
        setSalaryModalOpen(false);
        await fetchData();
      }
    } catch (err) {
      console.error("Error resetting salary config:", err);
      toast.error("Failed to reset teacher salary configuration.");
    } finally {
      setSavingSalary(false);
    }
  };

  // Live preview calculation inside modal (Gross -> WHT -> Net)
  const modalLivePreview = useMemo(() => {
    if (!selectedSubjectForSalary) return { grossSalary: 0, whtRate: 0, whtAmount: 0, netSalary: 0, instituteShare: 0, formula: '' };
    const { subject } = selectedSubjectForSalary;
    const revenue = subject.totalAmount || 0;
    const students = subject.totalApproved || 0;

    let gross = 0;
    let baseFormula = '';
    if (formModel === 'FIXED') {
      gross = Math.round(parseFloat(formFixedAmount) || 0);
      baseFormula = `Fixed: Rs. ${gross.toLocaleString()}`;
    } else {
      if (formCommissionType === 'PER_STUDENT') {
        const rate = parseFloat(formPerStudentRate) || 0;
        gross = Math.round(students * rate);
        baseFormula = `Rs. ${rate.toLocaleString()} × ${students} stu = Rs. ${gross.toLocaleString()}`;
      } else {
        const pct = parseFloat(formCommissionRate) || 0;
        gross = Math.round((revenue * pct) / 100);
        baseFormula = `${pct}% of Rs. ${revenue.toLocaleString()} = Rs. ${gross.toLocaleString()}`;
      }
    }

    const wht = Math.max(0, parseFloat(formWhtRate) || 0);
    const whtAmt = wht > 0 ? Math.round((gross * wht) / 100) : 0;
    const net = Math.max(0, gross - whtAmt);
    const institute = Math.max(0, revenue - gross);

    return {
      grossSalary: gross,
      whtRate: wht,
      whtAmount: whtAmt,
      netSalary: net,
      instituteShare: institute,
      formula: wht > 0 ? `${baseFormula} (WHT ${wht}%: -Rs. ${whtAmt.toLocaleString()})` : baseFormula
    };
  }, [selectedSubjectForSalary, formModel, formCommissionType, formCommissionRate, formPerStudentRate, formFixedAmount, formWhtRate]);

  // Open Print Modal for a lecturer
  const handlePrintLecturer = (lecturer) => {
    setSelectedLecturerForPrint(lecturer);
    setShowPrintModal(true);
  };

  const executePrint = () => {
    window.print();
  };

  return (
    <div className="w-full text-slate-200 pb-16 font-sans relative">
      {/* HEADER SECTION */}
      <div className="bg-[#1e2336]/70 p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-2xl backdrop-blur-xl mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-2xl shadow-lg shadow-purple-500/20 text-white shrink-0">
              <GraduationCap size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-wide">
                  Teachers Salary
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300">
                  Payment Hub • Student Count Sync
                </span>
              </div>
              <p className="text-slate-400 font-medium text-sm mt-1">
                Lecturers from Delivery Department • Content Hub Batches • Paid Student Counts strictly from Payment Hub & Finance Matrix Engine.
              </p>
            </div>
          </div>

          {/* QUICK CONTROLS & EXPORT */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Buttons */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-semibold">
              <button
                onClick={() => setViewMode('CARDS')}
                className={`px-3 py-1.5 rounded-lg transition-all ${viewMode === 'CARDS' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Cards View
              </button>
              <button
                onClick={() => setViewMode('TABLE')}
                className={`px-3 py-1.5 rounded-lg transition-all ${viewMode === 'TABLE' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
              >
                Detailed Table
              </button>
            </div>

            {/* CSV Export */}
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm hover:shadow-emerald-500/10"
              title="Download full CSV report"
            >
              <Download size={14} />
              <span>CSV Export</span>
            </button>

            {/* Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold transition-all"
              title="Refresh Data"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-purple-400" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* MONTHWISE BILLING CYCLE SELECTOR (1 - 30 or 1 - 31 of a month) */}
        <div className="mt-6 pt-5 border-t border-white/5 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">

            {/* Cycle Mode & Stepper */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider">
                <Calendar size={14} className="text-purple-400" />
                <span>Billing Cycle: Monthwise (1 - 30 / 1 - 31)</span>
              </div>

              {/* Mode Buttons */}
              <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 text-xs font-semibold">
                <button
                  onClick={() => setCycleMode('MONTHWISE')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${cycleMode === 'MONTHWISE'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold ring-1 ring-purple-400'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Monthwise (1 - 30/31)
                </button>
                <button
                  onClick={() => setCycleMode('ALL_TIME')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${cycleMode === 'ALL_TIME'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold ring-1 ring-purple-400'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setCycleMode('CUSTOM')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${cycleMode === 'CUSTOM'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 font-bold ring-1 ring-purple-400'
                    : 'text-slate-400 hover:text-white'
                    }`}
                >
                  Custom Range
                </button>
              </div>
            </div>

            {/* Expand / Collapse Controls */}
            <div className="flex items-center gap-2 text-xs text-slate-400 self-end xl:self-auto">
              <button
                onClick={expandAll}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 font-semibold transition-colors"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 font-semibold transition-colors"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* MONTHWISE ACTIVE CYCLE BAR */}
          {cycleMode === 'MONTHWISE' && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-black/40 rounded-2xl border border-white/10 animate-fade-in">
              <div className="flex flex-wrap items-center gap-2">
                {/* Prev Month Button */}
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                  title="Previous Billing Month"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Month Dropdown */}
                <select
                  value={selectedBillingMonth}
                  onChange={(e) => setSelectedBillingMonth(e.target.value)}
                  className="bg-[#1e2336] border border-purple-500/40 text-purple-300 font-bold text-xs px-3.5 py-2 rounded-xl focus:outline-none focus:border-purple-400 cursor-pointer shadow-sm"
                >
                  {availableBillingMonths.map((m) => (
                    <option key={m.key} value={m.key} className="bg-[#181d2e] text-white font-medium">
                      📅 {m.label} ({(m.paymentsCount || 0).toLocaleString()} payments)
                    </option>
                  ))}
                </select>

                {/* Next Month Button */}
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all"
                  title="Next Billing Month"
                >
                  <ChevronRight size={16} />
                </button>

                {/* Quick Month Pills */}
                <div className="hidden lg:flex items-center gap-1.5 ml-2 border-l border-white/10 pl-3">
                  {availableBillingMonths.slice(0, 6).map((m) => {
                    const isSelected = selectedBillingMonth === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setSelectedBillingMonth(m.key)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${isSelected
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400'
                          : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        {m.name.slice(0, 3)} (1-{m.lastDay})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exact Cycle Window Badge */}
              {activeCycle && (
                <div className="flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-slate-300">Cycle Window:</span>
                  <strong className="text-white font-black">{activeCycle.startDate}</strong>
                  <span className="text-slate-500">to</span>
                  <strong className="text-white font-black">{activeCycle.endDate}</strong>
                  <span className="text-[10px] text-emerald-400/90 font-bold uppercase">(1 - {activeCycle.lastDay} Days)</span>
                </div>
              )}
            </div>
          )}

          {/* CUSTOM RANGE BAR */}
          {cycleMode === 'CUSTOM' && (
            <div className="flex flex-wrap items-center gap-3 p-3 bg-black/40 rounded-2xl border border-white/10 animate-fade-in text-xs">
              <span className="text-slate-400 font-bold">Custom Billing Range:</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-black/60 border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-purple-500"
                />
                <span className="text-slate-500 font-bold">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-black/60 border border-white/10 text-white text-xs px-3 py-1.5 rounded-lg focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* EXECUTIVE KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
        {/* Active Lecturers */}
        <div className="bg-[#1e2336]/80 p-3.5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lecturers</span>
            <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
              <Users size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-white">{summary.totalLecturers}</p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">Assigned Lecturers</p>
        </div>

        {/* Total Approved Paid Students */}
        <div className="bg-[#1e2336]/80 p-3.5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Paid Students</span>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-emerald-400">
            {(summary.totalApprovedStudents || 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">Approved (Excl. Free)</p>
        </div>

        {/* Full Payment Students */}
        <div className="bg-[#1e2336]/80 p-3.5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300">Full</span>
            <div className="p-1.5 bg-purple-500/10 rounded-lg text-purple-400">
              <GraduationCap size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-purple-300">
            {(summary.totalFullPayments || 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-purple-400 font-bold mt-0.5 truncate">
            Rs. {(summary.totalFullRevenue || 0).toLocaleString()}
          </p>
        </div>

        {/* Monthly Payment Students */}
        <div className="bg-[#1e2336]/80 p-3.5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group hover:border-blue-500/30 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Monthly</span>
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400">
              <Calendar size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-blue-300">
            {(summary.totalMonthlyPayments || 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-blue-400 font-bold mt-0.5 truncate">
            Rs. {(summary.totalMonthlyRevenue || 0).toLocaleString()}
          </p>
        </div>

        {/* Adjusted Students */}
        <div className="bg-[#1e2336]/80 p-3.5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Adjusted</span>
            <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400">
              <AlertTriangle size={15} />
            </div>
          </div>
          <p className="text-xl font-black text-amber-400">
            {(summary.totalAdjustedPayments || 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-amber-400 font-bold mt-0.5 truncate">
            Rs. {(summary.totalAdjustedRevenue || 0).toLocaleString()}
          </p>
        </div>

        {/* Total Apportioned Revenue */}
        <div className="bg-[#1e2336]/80 p-3.5 rounded-2xl border border-white/5 shadow-lg relative overflow-hidden group hover:border-teal-500/30 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">Total Collection</span>
            <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400">
              <DollarSign size={15} />
            </div>
          </div>
          <p className="text-lg font-black text-teal-300 truncate">
            Rs. {((summary.totalRevenue || 0) / 1000000).toFixed(2)}M
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5 truncate">Fee Collection</p>
        </div>

        {/* Total Teachers Salary Payable */}
        <div className="bg-gradient-to-br from-[#1b2f29] to-[#142320] p-3.5 rounded-2xl border border-emerald-500/30 shadow-lg relative overflow-hidden group hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">Teacher Salary</span>
            <div className="p-1.5 bg-emerald-500/20 rounded-lg text-emerald-400 shadow-sm">
              <Wallet size={15} />
            </div>
          </div>
          <p className="text-lg font-black text-emerald-300 truncate">
            Rs. {((summary.totalTeacherSalary || 0) / 1000000).toFixed(2)}M
          </p>
          <p className="text-[10px] text-emerald-400/90 font-bold mt-0.5 truncate">
            Rs. {(summary.totalTeacherSalary || 0).toLocaleString()}
          </p>
          {(summary.totalWhtAmount || 0) > 0 && (
            <p className="text-[9.5px] text-amber-400 font-semibold truncate mt-0.5">
              WHT: -Rs. {(summary.totalWhtAmount || 0).toLocaleString()}
            </p>
          )}
        </div>

        {/* Institute Balance Retained */}
        <div className="bg-gradient-to-br from-[#241d37] to-[#181628] p-3.5 rounded-2xl border border-purple-500/30 shadow-lg relative overflow-hidden group hover:border-purple-400 transition-all">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">Institute Net</span>
            <div className="p-1.5 bg-purple-500/20 rounded-lg text-purple-400 shadow-sm">
              <CreditCard size={15} />
            </div>
          </div>
          <p className="text-lg font-black text-purple-300 truncate">
            Rs. {((summary.totalInstituteShare || 0) / 1000000).toFixed(2)}M
          </p>
          <p className="text-[10px] text-purple-400/90 font-bold mt-0.5 truncate">
            Rs. {(summary.totalInstituteShare || 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="bg-[#1e2336]/60 p-4 rounded-2xl border border-white/5 shadow-lg mb-8 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search lecturer, subject, or batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Business Selector */}
        <div className="w-full md:w-56 shrink-0">
          <select
            value={selectedBusiness}
            onChange={(e) => {
              setSelectedBusiness(e.target.value);
              setSelectedBatch('All');
            }}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="All" className="bg-[#1e2336]">All Businesses ({businesses.length})</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#1e2336]">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Batch Selector */}
        <div className="w-full md:w-56 shrink-0">
          <select
            value={selectedBatch}
            onChange={(e) => setSelectedBatch(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="All" className="bg-[#1e2336]">All Batches ({availableBatches.length})</option>
            {availableBatches.map((b) => (
              <option key={b.id} value={b.id} className="bg-[#1e2336]">
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Payment Type Selector */}
        <div className="w-full md:w-44 shrink-0">
          <select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
          >
            <option value="All" className="bg-[#1e2336]">All Payment Types</option>
            <option value="Full" className="bg-[#1e2336]">Full Payments Only</option>
            <option value="Monthly" className="bg-[#1e2336]">Monthly Payments Only</option>
            <option value="Adjusted" className="bg-[#1e2336]">Adjusted Payments Only</option>
          </select>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      {loading ? (
        <div className="py-24 text-center bg-[#1e2336]/40 rounded-3xl border border-white/5 flex flex-col items-center justify-center">
          <RefreshCw size={36} className="text-purple-400 animate-spin mb-4" />
          <p className="text-white font-bold text-base">Calculating Teachers Salary Breakdown...</p>
          <p className="text-slate-500 text-xs mt-1">Aggregating Content Hub courses and Manage Payments records.</p>
        </div>
      ) : filteredLecturers.length === 0 ? (
        <div className="py-24 text-center bg-[#1e2336]/40 rounded-3xl border border-white/5 flex flex-col items-center justify-center">
          <BookOpen size={40} className="text-slate-600 mb-3" />
          <h3 className="text-lg font-bold text-white">No lecturer salary records found</h3>
          <p className="text-slate-500 text-xs mt-1 max-w-md">
            No active courses or payments matched your selected billing cycle. Try switching the billing month or business filter.
          </p>
        </div>
      ) : viewMode === 'CARDS' ? (
        /* CARDS & NESTED BREAKDOWN VIEW */
        <div className="space-y-4">
          {filteredLecturers.map((lecturer) => {
            const isExpanded = !!expandedLecturers[lecturer.id];

            return (
              <div
                key={lecturer.id}
                className="bg-[#1e2336]/80 rounded-2xl border border-white/5 shadow-xl transition-all overflow-hidden"
              >
                {/* LECTURER HEADER CARD */}
                <div
                  onClick={() => toggleExpand(lecturer.id)}
                  className="p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <TeacherAvatar
                      image={lecturer.image}
                      name={lecturer.name}
                      size="w-12 h-12"
                      textSize="text-sm"
                    />
                    <div>
                      <h3 className="text-base md:text-lg font-black text-white hover:text-purple-300 transition-colors">
                        {lecturer.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400 font-medium">
                        <span className="flex items-center gap-1">
                          <Briefcase size={12} className="text-purple-400" />
                          {lecturer.businessesCount} {lecturer.businessesCount === 1 ? 'Business' : 'Businesses'}
                        </span>
                        <span>•</span>
                        <span>{lecturer.batchesCount} Batches</span>
                        <span>•</span>
                        <span>{lecturer.subjectsCount} Subjects</span>
                      </div>
                    </div>
                  </div>

                  {/* LECTURER METRICS BADGES */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Monthly Count Badge */}
                    <div className="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center gap-1.5 text-xs font-bold">
                      <Calendar size={14} className="text-blue-400" />
                      <span>{(lecturer.monthlyCount || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-blue-400/80 uppercase font-semibold">
                        Monthly (Rs. {(lecturer.monthlyAmount || 0).toLocaleString()})
                      </span>
                    </div>

                    {/* Full Count Badge */}
                    <div className="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-1.5 text-xs font-bold">
                      <GraduationCap size={14} className="text-purple-400" />
                      <span>{(lecturer.fullCount || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-purple-400/80 uppercase font-semibold">
                        Full (Rs. {(lecturer.fullAmount || 0).toLocaleString()})
                      </span>
                    </div>

                    {/* Upgrade Count Badge */}
                    {lecturer.upgradeCount > 0 && (
                      <div className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-1.5 text-xs font-bold">
                        <Sparkles size={14} className="text-rose-400" />
                        <span>{(lecturer.upgradeCount || 0).toLocaleString()}</span>
                        <span className="text-[10px] text-rose-400/80 uppercase font-semibold">
                          Upgrade (Rs. {(lecturer.upgradeAmount || 0).toLocaleString()})
                        </span>
                      </div>
                    )}

                    {/* Installment Count Badge */}
                    {((lecturer.installmentCount || lecturer.mixCount || 0) > 0) && (
                      <div className="px-3 py-1.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-300 flex items-center gap-1.5 text-xs font-bold">
                        <Layers size={14} className="text-fuchsia-400" />
                        <span>{((lecturer.installmentCount || lecturer.mixCount || 0)).toLocaleString()}</span>
                        <span className="text-[10px] text-fuchsia-400/80 uppercase font-semibold">
                          Installment (Rs. {((lecturer.installmentAmount || lecturer.mixAmount || 0)).toLocaleString()})
                        </span>
                      </div>
                    )}

                    {/* Adjusted Count Badge */}
                    <div className="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1.5 text-xs font-bold">
                      <AlertTriangle size={14} className="text-amber-400" />
                      <span>{(lecturer.adjustedCount || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-amber-400/80 uppercase font-semibold">
                        Adjusted (Rs. {(lecturer.adjustedAmount || 0).toLocaleString()})
                      </span>
                    </div>

                    {/* Total Approved Badge */}
                    <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 text-xs font-black">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      <span>{(lecturer.totalApproved || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-emerald-400/80 uppercase font-semibold">Total Paid</span>
                    </div>

                    {/* Total Collection */}
                    <div className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 flex items-center gap-1.5 text-xs font-bold">
                      <DollarSign size={14} className="text-teal-400" />
                      <span>Rs. {(lecturer.totalAmount || 0).toLocaleString()}</span>
                    </div>

                    {/* Net Teacher Salary Badge */}
                    <div className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1.5 text-xs font-black shadow-md shadow-emerald-500/10">
                      <Wallet size={14} className="text-emerald-400" />
                      <span>Net Salary: Rs. {(lecturer.teacherSalary || 0).toLocaleString()}</span>
                    </div>

                    {/* WHT Deduction Badge */}
                    {(lecturer.whtAmount || 0) > 0 && (
                      <div className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-center gap-1 text-xs font-bold" title="Withholding Tax Deducted">
                        <span>WHT: -Rs. {(lecturer.whtAmount || 0).toLocaleString()}</span>
                      </div>
                    )}

                    {/* Print Statement Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintLecturer(lecturer);
                      }}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                      title="Print Salary Statement"
                    >
                      <Printer size={15} />
                    </button>

                    {/* Expand Chevron */}
                    <div className="p-1 text-slate-400">
                      {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </div>
                  </div>
                </div>

                {/* EXPANDED BREAKDOWN AREA */}
                {isExpanded && (
                  <div className="p-4 md:p-6 bg-black/30 border-t border-white/5 space-y-6">
                    {lecturer.businesses?.map((business) => (
                      <div
                        key={business.id}
                        className="bg-[#1e2336]/50 rounded-xl border border-white/5 overflow-hidden"
                      >
                        {/* BUSINESS HEADER */}
                        <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                            <h4 className="text-sm font-bold text-white tracking-wide">
                              Business: {business.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-300">
                            <span className="text-blue-300">Monthly: {business.monthlyCount} (Rs. {(business.monthlyAmount || 0).toLocaleString()})</span>
                            <span>•</span>
                            <span className="text-purple-300">Full: {business.fullCount} (Rs. {(business.fullAmount || 0).toLocaleString()})</span>
                            {business.upgradeCount > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-rose-300">Upgrade: {business.upgradeCount} (Rs. {(business.upgradeAmount || 0).toLocaleString()})</span>
                              </>
                            )}
                            {((business.installmentCount || business.mixCount || 0) > 0) && (
                              <>
                                <span>•</span>
                                <span className="text-fuchsia-300">Installment: {business.installmentCount || business.mixCount} (Rs. {((business.installmentAmount || business.mixAmount || 0)).toLocaleString()})</span>
                              </>
                            )}
                            <span>•</span>
                            <span className="text-amber-300">Adjusted: {business.adjustedCount} (Rs. {(business.adjustedAmount || 0).toLocaleString()})</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-bold">Total: {business.totalApproved} (Rs. {(business.totalAmount || 0).toLocaleString()})</span>
                            <span>•</span>
                            <span className="text-emerald-300 font-black bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                              Salary: Rs. {(business.teacherSalary || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* 🔥 CONSOLIDATED MULTI-BATCH SALARY SLIP BAR (ALTOGETHER SLIP) 🔥 */}
                        {business.batches && business.batches.length > 0 && (() => {
                          const isMarked = (bId) => markedBatches[business.id]?.[bId] !== false;
                          const markedBatchList = business.batches.filter(b => isMarked(b.id));
                          const allSelected = markedBatchList.length === business.batches.length;

                          // Gather live adjusted data from all marked batches' duplicate sheets
                          const consolidatedAdjSubjects = markedBatchList.flatMap(batch =>
                            (batch.subjects || []).map(s => ({
                              subject: s,
                              adj: getSubjectAdjustedData(s, batch.id, lecturer.name),
                              batchId: batch.id,
                              batchName: batch.name
                            }))
                          );

                          const consolidatedSubtotal = consolidatedAdjSubjects.reduce((acc, { adj }) => {
                            acc.monthlyCount += (adj.monthlyCount || 0);
                            acc.monthlyAmount += (adj.monthlyAmount || 0);
                            acc.fullCount += (adj.fullCount || 0);
                            acc.fullAmount += (adj.fullAmount || 0);
                            acc.upgradeCount += (adj.upgradeCount || 0);
                            acc.upgradeAmount += (adj.upgradeAmount || 0);
                            acc.installmentCount = (acc.installmentCount || 0) + (adj.installmentCount ?? adj.mixCount ?? 0);
                            acc.installmentAmount = (acc.installmentAmount || 0) + (adj.installmentAmount ?? adj.mixAmount ?? 0);
                            acc.mixCount += (adj.installmentCount ?? adj.mixCount ?? 0);
                            acc.mixAmount += (adj.installmentAmount ?? adj.mixAmount ?? 0);
                            acc.adjustedCount += (adj.adjustedCount || 0);
                            acc.adjustedAmount += (adj.adjustedAmount || 0);
                            acc.totalApproved += (adj.totalApproved || 0);
                            acc.totalAmount += (adj.totalAmount || 0);
                            acc.grossSalary += (adj.grossSalary || 0);
                            acc.whtAmount += (adj.whtAmount || 0);
                            acc.teacherSalary += (adj.teacherSalary || 0);
                            acc.instituteShare += (adj.instituteShare || 0);
                            return acc;
                          }, {
                            monthlyCount: 0, monthlyAmount: 0,
                            fullCount: 0, fullAmount: 0,
                            upgradeCount: 0, upgradeAmount: 0,
                            installmentCount: 0, installmentAmount: 0,
                            mixCount: 0, mixAmount: 0,
                            adjustedCount: 0, adjustedAmount: 0,
                            totalApproved: 0, totalAmount: 0,
                            grossSalary: 0, whtAmount: 0, teacherSalary: 0, instituteShare: 0
                          });

                          const hasAnyMod = consolidatedAdjSubjects.some(item => item.adj.isModified);

                          return (
                            <div className="px-4 py-3 bg-gradient-to-r from-purple-950/60 via-indigo-950/40 to-slate-900/80 border-b border-purple-500/30 flex flex-wrap items-center justify-between gap-3 shadow-inner">
                              <div className="flex flex-wrap items-center gap-3">
                                {/* SELECT ALL TOGGLE */}
                                <label className="flex items-center gap-2 cursor-pointer bg-black/50 hover:bg-black/70 px-3 py-1.5 rounded-xl border border-purple-500/30 transition-all select-none">
                                  <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(e) => toggleSelectAllBatches(business, e.target.checked)}
                                    className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-white/20 focus:ring-purple-500 cursor-pointer"
                                  />
                                  <span className="text-xs font-black text-purple-200">
                                    {allSelected ? `All ${business.batches.length} Batches Marked` : `Marked ${markedBatchList.length} of ${business.batches.length} Batches`}
                                  </span>
                                </label>

                                {/* LIVE ALTOGETHER TOTALS (REFLECTING ALL DUPLICATE EDITS) */}
                                <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                  <span>
                                    Altogether Net Salary: <strong className="text-emerald-300 font-black text-sm">Rs. {(consolidatedSubtotal.teacherSalary || 0).toLocaleString()}</strong>
                                    <span className="text-slate-400 font-semibold ml-2">
                                      ({consolidatedSubtotal.totalApproved} Students • Gross Rs. {(consolidatedSubtotal.grossSalary || 0).toLocaleString()}{consolidatedSubtotal.whtAmount > 0 ? ` • WHT -Rs. ${consolidatedSubtotal.whtAmount.toLocaleString()}` : ''})
                                    </span>
                                    {hasAnyMod && (
                                      <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                        Duplicate Edits Applied
                                      </span>
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* ALTOGETHER SLIP BUTTONS */}
                              <div className="flex items-center gap-2.5">
                                <button
                                  type="button"
                                  disabled={markedBatchList.length === 0}
                                  onClick={() => handleOpenConsolidatedFinalSlipModal(business, lecturer, markedBatchList, consolidatedAdjSubjects, consolidatedSubtotal)}
                                  className="px-3.5 py-1.5 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-purple-500/40 hover:border-purple-300 shadow-md cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Preview consolidated final slip for all marked batches"
                                >
                                  <Eye size={14} className="text-purple-300" />
                                  <span>Preview Altogether Slip ({markedBatchList.length})</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={markedBatchList.length === 0}
                                  onClick={() => handleQuickDownloadConsolidatedSlip(business, lecturer, markedBatchList, consolidatedAdjSubjects, consolidatedSubtotal)}
                                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-purple-600/20 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="Download consolidated final salary slip PDF"
                                >
                                  <Download size={14} />
                                  <span>Download Altogether Slip</span>
                                </button>
                              </div>
                            </div>
                          );
                        })()}

                        {/* BATCHES UNDER BUSINESS */}
                        <div className="p-3 md:p-4 space-y-4">
                          {business.batches?.map((batch) => {
                            const theorySubjects = (batch.theorySubjects && batch.theorySubjects.length > 0)
                              ? batch.theorySubjects
                              : (batch.subjects?.filter(s => (s.classType || 1) === 1) || (batch.paperSubjects?.length ? [] : (batch.subjects || [])));

                            const paperSubjects = (batch.paperSubjects && batch.paperSubjects.length > 0)
                              ? batch.paperSubjects
                              : (batch.subjects?.filter(s => s.classType === 2) || []);

                            const sections = [];
                            if (theorySubjects.length > 0) {
                              sections.push({
                                type: 'THEORY',
                                classType: 1,
                                headerTitle: 'Theory Class (තියරි පන්ති)',
                                badgeText: 'Theory Modules',
                                headerTheme: 'blue',
                                subjects: theorySubjects
                              });
                            }
                            if (paperSubjects.length > 0) {
                              sections.push({
                                type: 'PAPER',
                                classType: 2,
                                headerTitle: 'Paper Class (පේපර් පන්ති)',
                                badgeText: 'Paper Class Modules',
                                headerTheme: 'purple',
                                subjects: paperSubjects
                              });
                            }
                            if (sections.length === 0 && (batch.subjects || []).length > 0) {
                              sections.push({
                                type: 'THEORY',
                                classType: 1,
                                headerTitle: 'Theory Class (තියරි පන්ති)',
                                badgeText: 'Theory Modules',
                                headerTheme: 'blue',
                                subjects: batch.subjects
                              });
                            }

                            return (
                              <div
                                key={batch.id}
                                className="bg-black/40 rounded-xl border border-white/5 overflow-hidden"
                              >
                                {/* BATCH HEADER */}
                                <div className="px-4 py-2.5 bg-white/[0.02] border-b border-white/5 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center gap-2.5">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={markedBatches[business.id]?.[batch.id] !== false}
                                        onChange={(e) => toggleMarkBatch(business.id, batch.id, e.target.checked)}
                                        className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-white/20 focus:ring-purple-500 cursor-pointer"
                                      />
                                      <span className="text-xs font-bold text-slate-200">
                                        Batch: {batch.name}
                                      </span>
                                    </label>
                                    {markedBatches[business.id]?.[batch.id] !== false ? (
                                      <span className="text-[9.5px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20 flex items-center gap-1">
                                        <Check size={10} />
                                        <span>Marked for Altogether Slip</span>
                                      </span>
                                    ) : (
                                      <span className="text-[9.5px] font-bold text-slate-500 bg-white/5 px-1.5 py-0.2 rounded">
                                        Excluded
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-400">
                                    <span className="text-blue-300">Monthly: {batch.monthlyCount} (Rs. {(batch.monthlyAmount || 0).toLocaleString()})</span>
                                    <span>•</span>
                                    <span className="text-purple-300">Full: {batch.fullCount} (Rs. {(batch.fullAmount || 0).toLocaleString()})</span>
                                    {batch.upgradeCount > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-rose-300">Upgrade: {batch.upgradeCount} (Rs. {(batch.upgradeAmount || 0).toLocaleString()})</span>
                                      </>
                                    )}
                                    {((batch.installmentCount || batch.mixCount || 0) > 0) && (
                                      <>
                                        <span>•</span>
                                        <span className="text-fuchsia-300">Installment: {batch.installmentCount || batch.mixCount} (Rs. {((batch.installmentAmount || batch.mixAmount || 0)).toLocaleString()})</span>
                                      </>
                                    )}
                                    <span>•</span>
                                    <span className="text-amber-300">Adjusted: {batch.adjustedCount} (Rs. {(batch.adjustedAmount || 0).toLocaleString()})</span>
                                    <span>•</span>
                                    <span className="text-emerald-400 font-bold">Approved: {batch.totalApproved} (Rs. {(batch.totalAmount || 0).toLocaleString()})</span>
                                    <span>•</span>
                                    <span className="text-emerald-300 font-black bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                      Salary: Rs. {(batch.teacherSalary || 0).toLocaleString()}
                                    </span>
                                  </div>
                                </div>

                                {/* RENDER SECTIONS (THEORY CLASS & PAPER CLASS) */}
                                {sections.map((section, sIdx) => {
                                  // Section Real Subtotal
                                  const sectionRealSubtotal = section.subjects.reduce((acc, s) => {
                                    acc.monthlyCount += (s.monthlyCount || 0);
                                    acc.monthlyAmount += (s.monthlyAmount || 0);
                                    acc.fullCount += (s.fullCount || 0);
                                    acc.fullAmount += (s.fullAmount || 0);
                                    acc.upgradeCount += (s.upgradeCount || 0);
                                    acc.upgradeAmount += (s.upgradeAmount || 0);
                                    acc.installmentCount = (acc.installmentCount || 0) + (s.installmentCount || s.mixCount || 0);
                                    acc.installmentAmount = (acc.installmentAmount || 0) + (s.installmentAmount || s.mixAmount || 0);
                                    acc.mixCount += (s.installmentCount || s.mixCount || 0);
                                    acc.mixAmount += (s.installmentAmount || s.mixAmount || 0);
                                    acc.adjustedCount += (s.adjustedCount || 0);
                                    acc.adjustedAmount += (s.adjustedAmount || 0);
                                    acc.totalApproved += (s.totalApproved || 0);
                                    acc.totalAmount += (s.totalAmount || 0);
                                    acc.grossSalary += (s.grossSalary || 0);
                                    acc.whtAmount += (s.whtAmount || 0);
                                    acc.teacherSalary += (s.teacherSalary || 0);
                                    acc.instituteShare += (s.instituteShare || 0);
                                    return acc;
                                  }, {
                                    monthlyCount: 0, monthlyAmount: 0,
                                    fullCount: 0, fullAmount: 0,
                                    upgradeCount: 0, upgradeAmount: 0,
                                    installmentCount: 0, installmentAmount: 0,
                                    mixCount: 0, mixAmount: 0,
                                    adjustedCount: 0, adjustedAmount: 0,
                                    totalApproved: 0, totalAmount: 0,
                                    grossSalary: 0, whtAmount: 0, teacherSalary: 0, instituteShare: 0
                                  });

                                  // Section Adjusted Data for Duplicate Sheet
                                  const sectionAdjSubjects = section.subjects.map(s => ({
                                    subject: s,
                                    adj: getSubjectAdjustedData(s, batch.id, lecturer.name)
                                  }));

                                  const sectionAdjSubtotal = sectionAdjSubjects.reduce((acc, { adj }) => {
                                    acc.monthlyCount += (adj.monthlyCount || 0);
                                    acc.monthlyAmount += (adj.monthlyAmount || 0);
                                    acc.fullCount += (adj.fullCount || 0);
                                    acc.fullAmount += (adj.fullAmount || 0);
                                    acc.upgradeCount += (adj.upgradeCount || 0);
                                    acc.upgradeAmount += (adj.upgradeAmount || 0);
                                    acc.installmentCount = (acc.installmentCount || 0) + (adj.installmentCount ?? adj.mixCount ?? 0);
                                    acc.installmentAmount = (acc.installmentAmount || 0) + (adj.installmentAmount ?? adj.mixAmount ?? 0);
                                    acc.mixCount += (adj.installmentCount ?? adj.mixCount ?? 0);
                                    acc.mixAmount += (adj.installmentAmount ?? adj.mixAmount ?? 0);
                                    acc.adjustedCount += (adj.adjustedCount || 0);
                                    acc.adjustedAmount += (adj.adjustedAmount || 0);
                                    acc.totalApproved += (adj.totalApproved || 0);
                                    acc.totalAmount += (adj.totalAmount || 0);
                                    acc.grossSalary += (adj.grossSalary || 0);
                                    acc.whtAmount += (adj.whtAmount || 0);
                                    acc.teacherSalary += (adj.teacherSalary || 0);
                                    acc.instituteShare += (adj.instituteShare || 0);
                                    return acc;
                                  }, {
                                    monthlyCount: 0, monthlyAmount: 0,
                                    fullCount: 0, fullAmount: 0,
                                    upgradeCount: 0, upgradeAmount: 0,
                                    installmentCount: 0, installmentAmount: 0,
                                    mixCount: 0, mixAmount: 0,
                                    adjustedCount: 0, adjustedAmount: 0,
                                    totalApproved: 0, totalAmount: 0,
                                    grossSalary: 0, whtAmount: 0, teacherSalary: 0, instituteShare: 0
                                  });

                                  const hasAnySectionMod = sectionAdjSubjects.some(item => item.adj.isModified);
                                  const sectionSalaryDiff = sectionAdjSubtotal.teacherSalary - sectionRealSubtotal.teacherSalary;
                                  const isPaperSection = section.type === 'PAPER';

                                  return (
                                    <div
                                      key={section.type}
                                      className={`${sIdx > 0 ? 'border-t-4 border-slate-900/90' : ''}`}
                                    >
                                      {/* 🌟 CLASS TYPE SECTION HEADER (THEORY CLASS or PAPER CLASS) 🌟 */}
                                      <div className={`px-4 py-2 border-b flex flex-wrap items-center justify-between gap-2 ${
                                        isPaperSection
                                          ? 'bg-gradient-to-r from-purple-950/70 via-[#261545] to-slate-950 border-purple-500/40 text-purple-200'
                                          : 'bg-gradient-to-r from-blue-950/60 via-[#132238] to-slate-950 border-blue-500/30 text-blue-200'
                                      }`}>
                                        <div className="flex items-center gap-2.5">
                                          {isPaperSection ? (
                                            <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                              <FileText size={15} />
                                            </div>
                                          ) : (
                                            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                              <BookOpen size={15} />
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <span className="text-xs font-black uppercase tracking-wider text-white">
                                              {section.headerTitle}
                                            </span>
                                            <span className={`text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                                              isPaperSection
                                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                                : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                            }`}>
                                              {section.badgeText}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-300">
                                          <span className="text-blue-300">Monthly: {sectionRealSubtotal.monthlyCount}</span>
                                          <span>•</span>
                                          <span className="text-purple-300">Full: {sectionRealSubtotal.fullCount}</span>
                                          <span>•</span>
                                          <span className="text-emerald-400 font-bold">Approved: {sectionRealSubtotal.totalApproved} (Rs. {(sectionRealSubtotal.totalAmount || 0).toLocaleString()})</span>
                                          <span>•</span>
                                          <span className="text-emerald-300 font-black bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                            Salary: Rs. {(sectionRealSubtotal.teacherSalary || 0).toLocaleString()}
                                          </span>
                                        </div>
                                      </div>

                                      {/* AUDITED REAL SYSTEM TABLE LABEL */}
                                      <div className="px-4 py-1.5 bg-blue-500/10 border-b border-blue-500/20 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                                          <span className="text-[10.5px] font-black uppercase tracking-wider text-blue-300">
                                            Real Audited System Calculation (Non-Editable / Actual Paid Count)
                                          </span>
                                        </div>
                                        <span className="text-[9.5px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                                          Finance Matrix Source
                                        </span>
                                      </div>

                                      {/* REAL SUBJECTS BREAKDOWN TABLE */}
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-left text-xs">
                                          <thead className="bg-black/60 text-slate-400 font-bold border-b border-white/5 uppercase text-[10px] tracking-wider">
                                            <tr>
                                              <th className="py-2.5 px-3">Subject / Course</th>
                                              <th className="py-2.5 px-3">Payment / Group Plan</th>
                                              <th className="py-2.5 px-3 text-right">Monthly (Students / Rev)</th>
                                              <th className="py-2.5 px-3 text-right">Full (Students / Rev)</th>
                                              <th className="py-2.5 px-3 text-right">Upgrade (Students / Rev)</th>
                                              <th className="py-2.5 px-3 text-right">Installment (Students / Rev)</th>
                                              <th className="py-2.5 px-3 text-right">Adjusted (Students / Rev)</th>
                                              <th className="py-2.5 px-3 text-right">Paid Students</th>
                                              <th className="py-2.5 px-3 text-right">Total Revenue (Rs.)</th>
                                              <th className="py-2.5 px-3 text-center">Salary Model</th>
                                              <th className="py-2.5 px-3 text-right">Teacher Salary (Rs.)</th>
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-white/5 font-medium">
                                            {section.subjects.map((subject) => {
                                              return (
                                                <tr
                                                  key={subject.id}
                                                  className="hover:bg-white/[0.02] transition-colors"
                                                >
                                                  <td className="py-2.5 px-3 text-white font-bold">
                                                    <div className="flex items-center gap-1.5">
                                                      <span>{subject.name}</span>
                                                      {isPaperSection && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                          Paper
                                                        </span>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="py-2.5 px-3 text-slate-300">
                                                    {subject.groupName || subject.groupType}
                                                  </td>
                                                  {/* MONTHLY STUDENTS & REVENUE */}
                                                  <td className="py-2.5 px-3 text-right">
                                                    <div className="font-bold text-blue-300 text-xs">
                                                      {subject.monthlyCount}
                                                    </div>
                                                    <div className="text-[11px] font-semibold text-blue-400/90 mt-0.5">
                                                      Rs. {Math.round(subject.monthlyAmount || 0).toLocaleString()}
                                                    </div>
                                                  </td>
                                                  {/* FULL STUDENTS & REVENUE */}
                                                  <td className="py-2.5 px-3 text-right">
                                                    <div className="font-bold text-purple-300 text-xs">
                                                      {subject.fullCount}
                                                    </div>
                                                    <div className="text-[11px] font-semibold text-purple-400/90 mt-0.5">
                                                      Rs. {Math.round(subject.fullAmount || 0).toLocaleString()}
                                                    </div>
                                                  </td>
                                                  {/* UPGRADE STUDENTS & REVENUE */}
                                                  <td className="py-2.5 px-3 text-right">
                                                    <div className="font-bold text-rose-300 text-xs">
                                                      {subject.upgradeCount || 0}
                                                    </div>
                                                    <div className="text-[11px] font-semibold text-rose-400/90 mt-0.5">
                                                      Rs. {Math.round(subject.upgradeAmount || 0).toLocaleString()}
                                                    </div>
                                                  </td>
                                                  {/* INSTALLMENT STUDENTS & REVENUE */}
                                                  <td className="py-2.5 px-3 text-right">
                                                    <div className="font-bold text-fuchsia-300 text-xs">
                                                      {subject.installmentCount || subject.mixCount || 0}
                                                    </div>
                                                    <div className="text-[11px] font-semibold text-fuchsia-400/90 mt-0.5">
                                                      Rs. {Math.round(subject.installmentAmount || subject.mixAmount || 0).toLocaleString()}
                                                    </div>
                                                  </td>
                                                  {/* ADJUSTED */}
                                                  <td className="py-2.5 px-3 text-right">
                                                    <div className="font-bold text-amber-300 text-xs">
                                                      {subject.adjustedCount > 0 ? (
                                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                          {subject.adjustedCount}
                                                        </span>
                                                      ) : (
                                                        0
                                                      )}
                                                    </div>
                                                    {(subject.adjustedAmount || 0) > 0 && (
                                                      <div className="text-[11px] font-semibold text-amber-400/90 mt-0.5 whitespace-nowrap">
                                                        Rs. {(Math.round(subject.adjustedAmount || 0)).toLocaleString()}
                                                      </div>
                                                    )}
                                                  </td>
                                                  {/* TOTAL PAID STUDENTS */}
                                                  <td className="py-2.5 px-3 text-right text-emerald-400 font-black text-xs">
                                                    {subject.totalApproved}
                                                  </td>
                                                  {/* TOTAL REVENUE (RS.) */}
                                                  <td className="py-2.5 px-3 text-right text-teal-300 font-black text-xs whitespace-nowrap">
                                                    Rs. {(Math.round(subject.totalAmount || 0)).toLocaleString()}
                                                  </td>

                                                  {/* SALARY MODEL BUTTON / BADGE */}
                                                  <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    {subject.salaryConfig ? (
                                                      <button
                                                        onClick={() => openSalarySetup(subject, batch, business, lecturer)}
                                                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all mx-auto shadow-sm"
                                                        title="Click to edit salary setup"
                                                      >
                                                        {subject.salaryConfig.model === 'FIXED' ? (
                                                          <>
                                                            <Wallet size={12} className="text-indigo-400" />
                                                            <span>Fixed: Rs. {(Number(subject.salaryConfig.fixedAmount) || 0).toLocaleString()}</span>
                                                          </>
                                                        ) : subject.salaryConfig.commissionType === 'PER_STUDENT' ? (
                                                          <>
                                                            <Users size={12} className="text-cyan-400" />
                                                            <span>Rs. {(Number(subject.salaryConfig.perStudentRate) || 0).toLocaleString()}/stu</span>
                                                          </>
                                                        ) : (
                                                          <>
                                                            <Percent size={12} className="text-emerald-400" />
                                                            <span>{subject.salaryConfig.commissionRate}% Comm</span>
                                                          </>
                                                        )}
                                                        {subject.salaryConfig.whtRate > 0 && (
                                                          <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                                            WHT {subject.salaryConfig.whtRate}%
                                                          </span>
                                                        )}
                                                        <Settings size={11} className="text-slate-400" />
                                                      </button>
                                                    ) : (
                                                      <button
                                                        onClick={() => openSalarySetup(subject, batch, business, lecturer)}
                                                        className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-dashed border-purple-400/40 text-purple-300 hover:bg-purple-500/20 text-[11px] font-bold flex items-center gap-1 transition-all mx-auto hover:border-purple-400"
                                                        title="Configure teacher salary model"
                                                      >
                                                        <Plus size={12} />
                                                        <span>Set Model</span>
                                                      </button>
                                                    )}
                                                  </td>

                                                  {/* TEACHER SALARY PAYABLE (RS.) */}
                                                  <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    <div className="font-black text-emerald-400 text-xs">
                                                      Rs. {(subject.teacherSalary || 0).toLocaleString()}
                                                    </div>
                                                    {(subject.whtAmount || 0) > 0 && (
                                                      <div className="text-[9.5px] text-amber-400 font-semibold mt-0.5 whitespace-nowrap">
                                                        Gross: Rs. {(subject.grossSalary || 0).toLocaleString()} (WHT -Rs. {(subject.whtAmount || 0).toLocaleString()})
                                                      </div>
                                                    )}
                                                    {(subject.teacherSalary || 0) > 0 && (
                                                      <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                        Inst: Rs. {(subject.instituteShare || 0).toLocaleString()}
                                                      </div>
                                                    )}
                                                  </td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>

                                          {/* SECTION REAL SUB-TOTAL FOOTER */}
                                          <tfoot className="bg-black/50 font-black border-t border-white/10 text-slate-300 text-[11px]">
                                            <tr>
                                              <td colSpan={2} className="py-2.5 px-3 text-slate-400 uppercase">
                                                {isPaperSection ? 'Paper Class Subtotal' : 'Theory Class Subtotal'}
                                              </td>
                                              <td className="py-2.5 px-3 text-right">
                                                <div className="font-bold text-blue-300">
                                                  {sectionRealSubtotal.monthlyCount}
                                                </div>
                                                <div className="text-[10px] text-blue-400/90 font-semibold">
                                                  Rs. {(sectionRealSubtotal.monthlyAmount || 0).toLocaleString()}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3 text-right">
                                                <div className="font-bold text-purple-300">
                                                  {sectionRealSubtotal.fullCount}
                                                </div>
                                                <div className="text-[10px] text-purple-400/90 font-semibold">
                                                  Rs. {(sectionRealSubtotal.fullAmount || 0).toLocaleString()}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3 text-right">
                                                <div className="font-bold text-rose-300">
                                                  {sectionRealSubtotal.upgradeCount || 0}
                                                </div>
                                                <div className="text-[10px] text-rose-400/90 font-semibold">
                                                  Rs. {(sectionRealSubtotal.upgradeAmount || 0).toLocaleString()}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3 text-right">
                                                <div className="font-bold text-fuchsia-300">
                                                  {sectionRealSubtotal.installmentCount || sectionRealSubtotal.mixCount || 0}
                                                </div>
                                                <div className="text-[10px] text-fuchsia-400/90 font-semibold">
                                                  Rs. {(sectionRealSubtotal.installmentAmount || sectionRealSubtotal.mixAmount || 0).toLocaleString()}
                                                </div>
                                              </td>
                                              <td className="py-2.5 px-3 text-right">
                                                <div className="font-bold text-amber-300">
                                                  {sectionRealSubtotal.adjustedCount || 0}
                                                </div>
                                                {(sectionRealSubtotal.adjustedAmount || 0) > 0 && (
                                                  <div className="text-[10px] text-amber-400/90 font-semibold whitespace-nowrap">
                                                    Rs. {(Math.round(sectionRealSubtotal.adjustedAmount || 0)).toLocaleString()}
                                                  </div>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-right text-emerald-400 font-black">
                                                {sectionRealSubtotal.totalApproved}
                                              </td>
                                              <td className="py-2.5 px-3 text-right text-teal-300 font-black whitespace-nowrap">
                                                Rs. {(sectionRealSubtotal.totalAmount || 0).toLocaleString()}
                                              </td>
                                              <td className="py-2.5 px-3 text-center text-slate-400 text-[10px] uppercase font-bold">
                                                Subtotal
                                              </td>
                                              <td className="py-2.5 px-3 text-right text-emerald-400 font-black text-xs whitespace-nowrap">
                                                <div>Rs. {(sectionRealSubtotal.teacherSalary || 0).toLocaleString()}</div>
                                                {(sectionRealSubtotal.whtAmount || 0) > 0 && (
                                                  <div className="text-[9.5px] text-amber-400 font-semibold mt-0.5 whitespace-nowrap">
                                                    Gross: Rs. {(sectionRealSubtotal.grossSalary || 0).toLocaleString()} (WHT -Rs. {(sectionRealSubtotal.whtAmount || 0).toLocaleString()})
                                                  </div>
                                                )}
                                              </td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>

                                      {/* 🔥 EDITABLE DUPLICATE TABLE (MANAGEMENT PAYOUT ADJUSTMENT FOR SECTION) 🔥 */}
                                      <div className="border-t-2 border-dashed border-amber-500/30 bg-amber-500/[0.02]">
                                        {/* DUPLICATE HEADER BAR */}
                                        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                                          <div className="flex items-center gap-2.5">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
                                            <div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                                                  <Edit3 size={13} className="text-amber-400" />
                                                  Custom Payout Sheet (Editable Duplicate) — {section.headerTitle}
                                                </span>
                                                {hasAnySectionMod && (
                                                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-500/40 animate-pulse">
                                                    Modified vs Real
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[10.5px] text-slate-400">
                                                Edit student counts below. Amounts and salary auto-adjust dynamically. Real system values above remain untouched.
                                              </p>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            {hasAnySectionMod && (
                                              <button
                                                type="button"
                                                onClick={() => handleResetBatchAdjustments(batch, section.subjects)}
                                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
                                                title="Reset this section to real system values"
                                              >
                                                <RotateCcw size={12} />
                                                <span>Reset to Real</span>
                                              </button>
                                            )}

                                            <button
                                              type="button"
                                              onClick={handleSaveAdjustments}
                                              disabled={savingAdjustments}
                                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                                              title="Save custom payout values for this billing month"
                                            >
                                              {savingAdjustments ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                                              <span>Save Payout</span>
                                            </button>
                                          </div>
                                        </div>

                                        {/* EDITABLE TABLE */}
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left text-xs">
                                            <thead className="bg-amber-950/40 text-amber-300/80 font-bold border-b border-amber-500/20 uppercase text-[10px] tracking-wider">
                                              <tr>
                                                <th className="py-2.5 px-3">Subject / Course</th>
                                                <th className="py-2.5 px-3">Payment / Group Plan</th>
                                                <th className="py-2.5 px-3 text-right">Monthly (Students / Rev)</th>
                                                <th className="py-2.5 px-3 text-right">Full (Students / Rev)</th>
                                                <th className="py-2.5 px-3 text-right">Upgrade (Students / Rev)</th>
                                                <th className="py-2.5 px-3 text-right">Installment (Students / Rev)</th>
                                                <th className="py-2.5 px-3 text-right">Adjusted (Students / Rev)</th>
                                                <th className="py-2.5 px-3 text-right">Paid Students</th>
                                                <th className="py-2.5 px-3 text-right">Total Revenue (Rs.)</th>
                                                <th className="py-2.5 px-3 text-center">Salary Model</th>
                                                <th className="py-2.5 px-3 text-right">Teacher Salary (Rs.)</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 font-medium">
                                              {sectionAdjSubjects.map(({ subject, adj }) => {
                                                return (
                                                  <tr
                                                    key={subject.id}
                                                    className={`hover:bg-amber-500/[0.04] transition-colors ${adj.isModified ? 'bg-amber-500/[0.03]' : ''}`}
                                                  >
                                                    <td className="py-2.5 px-3 text-white font-bold">
                                                      <div className="flex items-center gap-1.5">
                                                        <span>{subject.name}</span>
                                                        {isPaperSection && (
                                                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                            Paper
                                                          </span>
                                                        )}
                                                        {adj.isModified && (
                                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Modified row"></span>
                                                        )}
                                                      </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-slate-300">
                                                      {subject.groupName || subject.groupType}
                                                    </td>

                                                    {/* EDITABLE MONTHLY COUNT & AUTO REVENUE */}
                                                    <td className="py-2 px-3 text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <input
                                                          type="number"
                                                          min="0"
                                                          value={adj.monthlyCount}
                                                          onChange={(e) => handleCountChange(subject, batch.id, 'monthlyCount', e.target.value)}
                                                          className="w-16 bg-slate-900/90 border border-blue-500/50 focus:border-blue-400 rounded-lg px-2 py-1 text-center font-bold text-blue-300 text-xs outline-none shadow-sm focus:ring-1 focus:ring-blue-400"
                                                          title="Edit monthly student count"
                                                        />
                                                      </div>
                                                      <div className="text-[11px] font-semibold text-blue-400/90 mt-1 whitespace-nowrap">
                                                        Rs. {(adj.monthlyAmount || 0).toLocaleString()}
                                                      </div>
                                                    </td>

                                                    {/* EDITABLE FULL COUNT & AUTO REVENUE */}
                                                    <td className="py-2 px-3 text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <input
                                                          type="number"
                                                          min="0"
                                                          value={adj.fullCount}
                                                          onChange={(e) => handleCountChange(subject, batch.id, 'fullCount', e.target.value)}
                                                          className="w-16 bg-slate-900/90 border border-purple-500/50 focus:border-purple-400 rounded-lg px-2 py-1 text-center font-bold text-purple-300 text-xs outline-none shadow-sm focus:ring-1 focus:ring-purple-400"
                                                          title="Edit full card student count"
                                                        />
                                                      </div>
                                                      <div className="text-[11px] font-semibold text-purple-400/90 mt-1 whitespace-nowrap">
                                                        Rs. {(adj.fullAmount || 0).toLocaleString()}
                                                      </div>
                                                    </td>

                                                    {/* EDITABLE UPGRADE COUNT & AUTO REVENUE */}
                                                    <td className="py-2 px-3 text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <input
                                                          type="number"
                                                          min="0"
                                                          value={adj.upgradeCount}
                                                          onChange={(e) => handleCountChange(subject, batch.id, 'upgradeCount', e.target.value)}
                                                          className="w-14 bg-slate-900/90 border border-rose-500/50 focus:border-rose-400 rounded-lg px-1.5 py-1 text-center font-bold text-rose-300 text-xs outline-none shadow-sm focus:ring-1 focus:ring-rose-400"
                                                          title="Edit upgrade student count"
                                                        />
                                                      </div>
                                                      <div className="text-[11px] font-semibold text-rose-400/90 mt-1 whitespace-nowrap">
                                                        Rs. {(adj.upgradeAmount || 0).toLocaleString()}
                                                      </div>
                                                    </td>

                                                    {/* EDITABLE INSTALLMENT COUNT & AUTO REVENUE */}
                                                    <td className="py-2 px-3 text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <input
                                                          type="number"
                                                          min="0"
                                                          value={adj.installmentCount !== undefined ? adj.installmentCount : (adj.mixCount !== undefined ? adj.mixCount : (subject.installmentCount || subject.mixCount || 0))}
                                                          onChange={(e) => {
                                                            handleCountChange(subject, batch.id, 'installmentCount', e.target.value);
                                                            handleCountChange(subject, batch.id, 'mixCount', e.target.value);
                                                          }}
                                                          className="w-14 bg-slate-900/90 border border-fuchsia-500/50 focus:border-fuchsia-400 rounded-lg px-1.5 py-1 text-center font-bold text-fuchsia-300 text-xs outline-none shadow-sm focus:ring-1 focus:ring-fuchsia-400"
                                                          title="Edit installment student count"
                                                        />
                                                      </div>
                                                      <div className="text-[11px] font-semibold text-fuchsia-400/90 mt-1 whitespace-nowrap">
                                                        Rs. {(adj.installmentAmount !== undefined ? adj.installmentAmount : (adj.mixAmount || 0)).toLocaleString()}
                                                      </div>
                                                    </td>

                                                    {/* EDITABLE ADJUSTED COUNT & AUTO REVENUE */}
                                                    <td className="py-2 px-3 text-right">
                                                      <div className="flex items-center justify-end gap-1">
                                                        <input
                                                          type="number"
                                                          min="0"
                                                          value={adj.adjustedCount}
                                                          onChange={(e) => handleCountChange(subject, batch.id, 'adjustedCount', e.target.value)}
                                                          className="w-14 bg-slate-900/90 border border-amber-500/50 focus:border-amber-400 rounded-lg px-1.5 py-1 text-center font-bold text-amber-300 text-xs outline-none shadow-sm focus:ring-1 focus:ring-amber-400"
                                                          title="Edit adjusted student count"
                                                        />
                                                      </div>
                                                      <div className="text-[11px] font-semibold text-amber-400/90 mt-1 whitespace-nowrap">
                                                        Rs. {(adj.adjustedAmount || 0).toLocaleString()}
                                                      </div>
                                                    </td>

                                                    {/* TOTAL PAID STUDENTS (AUTO SUM) */}
                                                    <td className="py-2.5 px-3 text-right text-emerald-400 font-black text-xs">
                                                      {adj.totalApproved}
                                                    </td>

                                                    {/* TOTAL REVENUE (AUTO SUM) */}
                                                    <td className="py-2.5 px-3 text-right text-teal-300 font-black text-xs whitespace-nowrap">
                                                      Rs. {(adj.totalAmount || 0).toLocaleString()}
                                                    </td>

                                                    {/* SALARY MODEL */}
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                      {subject.salaryConfig ? (
                                                        <button
                                                          onClick={() => openSalarySetup(subject, batch, business, lecturer)}
                                                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all mx-auto shadow-sm cursor-pointer"
                                                          title="Click to edit salary setup"
                                                        >
                                                          {subject.salaryConfig.model === 'FIXED' ? (
                                                            <>
                                                              <Wallet size={12} className="text-indigo-400" />
                                                              <span>Fixed: Rs. {(Number(subject.salaryConfig.fixedAmount) || 0).toLocaleString()}</span>
                                                            </>
                                                          ) : subject.salaryConfig.commissionType === 'PER_STUDENT' ? (
                                                            <>
                                                              <Users size={12} className="text-cyan-400" />
                                                              <span>Rs. {(Number(subject.salaryConfig.perStudentRate) || 0).toLocaleString()}/stu</span>
                                                            </>
                                                          ) : (
                                                            <>
                                                              <Percent size={12} className="text-emerald-400" />
                                                              <span>{subject.salaryConfig.commissionRate}% Comm</span>
                                                            </>
                                                          )}
                                                          {subject.salaryConfig.whtRate > 0 && (
                                                            <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                                              WHT {subject.salaryConfig.whtRate}%
                                                            </span>
                                                          )}
                                                          <Settings size={11} className="text-slate-400" />
                                                        </button>
                                                      ) : (
                                                        <button
                                                          onClick={() => openSalarySetup(subject, batch, business, lecturer)}
                                                          className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-dashed border-purple-400/40 text-purple-300 hover:bg-purple-500/20 text-[11px] font-bold flex items-center gap-1 transition-all mx-auto hover:border-purple-400 cursor-pointer"
                                                          title="Configure teacher salary model"
                                                        >
                                                          <Plus size={12} />
                                                          <span>Set Model</span>
                                                        </button>
                                                      )}
                                                    </td>

                                                    {/* TEACHER SALARY PAYABLE (AUTO CALCULATED) */}
                                                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                      <div className="font-black text-emerald-400 text-xs">
                                                        Rs. {(adj.teacherSalary || 0).toLocaleString()}
                                                      </div>
                                                      {adj.whtAmount > 0 && (
                                                        <div className="text-[9.5px] text-amber-400 font-semibold mt-0.5 whitespace-nowrap">
                                                          Gross: Rs. {(adj.grossSalary || 0).toLocaleString()} (WHT -Rs. {(adj.whtAmount || 0).toLocaleString()})
                                                        </div>
                                                      )}
                                                      {adj.teacherSalary > 0 && (
                                                        <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                          Inst: Rs. {(adj.instituteShare || 0).toLocaleString()}
                                                        </div>
                                                      )}
                                                    </td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>

                                            {/* EDITABLE BATCH SECTION SUB-TOTAL FOOTER */}
                                            <tfoot className="bg-amber-950/30 font-black border-t-2 border-amber-500/30 text-slate-300 text-[11px]">
                                              <tr>
                                                <td colSpan={2} className="py-2.5 px-3 text-amber-300 uppercase">
                                                  <div className="flex items-center gap-1.5">
                                                    <span>{isPaperSection ? 'Paper Class Custom Payout Subtotal' : 'Theory Class Custom Payout Subtotal'}</span>
                                                    {sectionSalaryDiff !== 0 && (
                                                      <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded ${
                                                        sectionSalaryDiff > 0
                                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                                      }`}>
                                                        {sectionSalaryDiff > 0 ? `+Rs. ${(sectionSalaryDiff || 0).toLocaleString()} vs Real` : `-Rs. ${Math.abs(sectionSalaryDiff).toLocaleString()} vs Real`}
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <div className="font-bold text-blue-300">
                                                    {sectionAdjSubtotal.monthlyCount}
                                                  </div>
                                                  <div className="text-[10px] text-blue-400/90 font-semibold">
                                                    Rs. {(sectionAdjSubtotal.monthlyAmount || 0).toLocaleString()}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <div className="font-bold text-purple-300">
                                                    {sectionAdjSubtotal.fullCount}
                                                  </div>
                                                  <div className="text-[10px] text-purple-400/90 font-semibold">
                                                    Rs. {(sectionAdjSubtotal.fullAmount || 0).toLocaleString()}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <div className="font-bold text-rose-300">
                                                    {sectionAdjSubtotal.upgradeCount}
                                                  </div>
                                                  <div className="text-[10px] text-rose-400/90 font-semibold">
                                                    Rs. {(sectionAdjSubtotal.upgradeAmount || 0).toLocaleString()}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <div className="font-bold text-fuchsia-300">
                                                    {sectionAdjSubtotal.installmentCount ?? sectionAdjSubtotal.mixCount ?? 0}
                                                  </div>
                                                  <div className="text-[10px] text-fuchsia-400/90 font-semibold">
                                                    Rs. {(sectionAdjSubtotal.installmentAmount ?? sectionAdjSubtotal.mixAmount ?? 0).toLocaleString()}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-right">
                                                  <div className="font-bold text-amber-300">
                                                    {sectionAdjSubtotal.adjustedCount}
                                                  </div>
                                                  <div className="text-[10px] text-amber-400/90 font-semibold whitespace-nowrap">
                                                    Rs. {(sectionAdjSubtotal.adjustedAmount || 0).toLocaleString()}
                                                  </div>
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-emerald-400 font-black">
                                                  {sectionAdjSubtotal.totalApproved}
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-teal-300 font-black whitespace-nowrap">
                                                  Rs. {(sectionAdjSubtotal.totalAmount || 0).toLocaleString()}
                                                </td>
                                                <td className="py-2.5 px-3 text-center text-amber-400 text-[10px] uppercase font-bold">
                                                  Adjusted Subtotal
                                                </td>
                                                <td className="py-2.5 px-3 text-right text-emerald-400 font-black text-xs whitespace-nowrap">
                                                  <div>Rs. {(sectionAdjSubtotal.teacherSalary || 0).toLocaleString()}</div>
                                                  {sectionAdjSubtotal.whtAmount > 0 && (
                                                    <div className="text-[9.5px] text-amber-400 font-semibold mt-0.5 whitespace-nowrap">
                                                      Gross: Rs. {(sectionAdjSubtotal.grossSalary || 0).toLocaleString()} (WHT -Rs. {(sectionAdjSubtotal.whtAmount || 0).toLocaleString()})
                                                    </div>
                                                  )}
                                                </td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>

                                        {/* 🔥 BOTTOM ACTION BAR: PREVIEW & DOWNLOAD FINAL SLIP FOR SECTION 🔥 */}
                                        <div className="px-4 py-3 bg-slate-950/90 border-t border-amber-500/20 flex flex-wrap items-center justify-between gap-3">
                                          <div className="flex items-center gap-2 text-xs text-slate-300">
                                            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                                            <span>
                                              Final Calculated Payout: <strong className="text-emerald-300 font-black text-sm">Rs. {(sectionAdjSubtotal.teacherSalary || 0).toLocaleString()}</strong>
                                              <span className="text-slate-400 font-semibold ml-2">({sectionAdjSubtotal.totalApproved} Students • Gross Rs. {(sectionAdjSubtotal.grossSalary || 0).toLocaleString()})</span>
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-2.5">
                                            <button
                                              type="button"
                                              onClick={() => handleOpenPreSlipModal({
                                                lecturer,
                                                business,
                                                batch: {
                                                  ...batch,
                                                  name: `${batch.name}${isPaperSection ? ' - Paper Class' : ''}`,
                                                  sectionType: section.type,
                                                  sectionTitle: section.headerTitle
                                                },
                                                adjSubjects: sectionAdjSubjects,
                                                subtotalAdj: sectionAdjSubtotal,
                                                salaryDiff: sectionSalaryDiff,
                                                sectionType: section.type,
                                                modeLabel: isPaperSection ? 'Paper Class Examination Modules' : 'Theory & Apportioned Modules'
                                              })}
                                              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-amber-500/40 hover:border-amber-300 shadow-md cursor-pointer active:scale-95"
                                              title={`Preview final salary slip for ${section.headerTitle}`}
                                            >
                                              <Eye size={14} className="text-amber-400" />
                                              <span>Preview Final Slip</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => handleQuickDownloadSlip({
                                                lecturer,
                                                business,
                                                batch: {
                                                  ...batch,
                                                  name: `${batch.name}${isPaperSection ? ' - Paper Class' : ''}`,
                                                  sectionType: section.type,
                                                  sectionTitle: section.headerTitle
                                                },
                                                adjSubjects: sectionAdjSubjects,
                                                subtotalAdj: sectionAdjSubtotal,
                                                salaryDiff: sectionSalaryDiff,
                                                sectionType: section.type,
                                                modeLabel: isPaperSection ? 'Paper Class Examination Modules' : 'Theory & Apportioned Modules'
                                              })}
                                              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20 cursor-pointer active:scale-95"
                                              title={`Download final salary slip PDF for ${section.headerTitle}`}
                                            >
                                              <Download size={14} />
                                              <span>Download Final Slip</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* DETAILED FLAT TABLE VIEW */
        <div className="bg-[#1e2336]/80 rounded-2xl border border-white/5 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/60 text-slate-400 font-bold border-b border-white/5 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Lecturer</th>
                  <th className="py-3 px-3">Business</th>
                  <th className="py-3 px-3">Batch</th>
                  <th className="py-3 px-3">Subject</th>
                  <th className="py-3 px-3">Plan / Group</th>
                  <th className="py-3 px-3 text-right">Monthly (Qty / Rev)</th>
                  <th className="py-3 px-3 text-right">Full (Qty / Rev)</th>
                  <th className="py-3 px-3 text-right">Upgrade (Qty / Rev)</th>
                  <th className="py-3 px-3 text-right">Installment (Qty / Rev)</th>
                  <th className="py-3 px-3 text-right">Adjusted (Qty / Rev)</th>
                  <th className="py-3 px-3 text-right">Paid Students</th>
                  <th className="py-3 px-4 text-right">Total Revenue (Rs.)</th>
                  <th className="py-3 px-3 text-center">Salary Model</th>
                  <th className="py-3 px-4 text-right">Teacher Salary (Rs.)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {filteredLecturers.flatMap((l) =>
                  l.businesses?.flatMap((b) =>
                    b.batches?.flatMap((bt) =>
                      bt.subjects?.map((s) => {
                        return (
                          <tr
                            key={`${l.id}-${b.id}-${bt.id}-${s.id}-${s.classType || 1}`}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                              {l.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                              {b.name}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                              {bt.name}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-white whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <span>{s.name}</span>
                                {(s.classType === 2 || s.isPaperClass) && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                    Paper
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                              {s.groupName || s.groupType}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="font-bold text-blue-300 text-xs">{s.monthlyCount}</div>
                              <div className="text-[10px] text-blue-400/90 font-semibold">
                                Rs. {Math.round(s.monthlyAmount || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="font-bold text-purple-300 text-xs">{s.fullCount}</div>
                              <div className="text-[10px] text-purple-400/90 font-semibold">
                                Rs. {Math.round(s.fullAmount || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="font-bold text-rose-300 text-xs">{s.upgradeCount || 0}</div>
                              <div className="text-[10px] text-rose-400/90 font-semibold">
                                Rs. {Math.round(s.upgradeAmount || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="font-bold text-fuchsia-300 text-xs">{s.installmentCount || s.mixCount || 0}</div>
                              <div className="text-[10px] text-fuchsia-400/90 font-semibold">
                                Rs. {Math.round(s.installmentAmount || s.mixAmount || 0).toLocaleString()}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="font-bold text-amber-300 text-xs">
                                {s.adjustedCount > 0 ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    {s.adjustedCount}
                                  </span>
                                ) : (
                                  0
                                )}
                              </div>
                              {(s.adjustedAmount || 0) > 0 && (
                                <div className="text-[10px] text-amber-400/90 font-semibold">
                                  Rs. {Math.round(s.adjustedAmount || 0).toLocaleString()}
                                </div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 font-black whitespace-nowrap">
                              {s.totalApproved}
                            </td>
                            <td className="py-2.5 px-4 text-right text-teal-300 font-black whitespace-nowrap">
                              Rs. {(Math.round(s.totalAmount || 0)).toLocaleString()}
                            </td>

                            {/* Salary Model */}
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              {s.salaryConfig ? (
                                <button
                                  onClick={() => openSalarySetup(s, bt, b, l)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold text-[11px] flex items-center gap-1 hover:bg-emerald-500/20 transition-all mx-auto shadow-sm"
                                  title="Edit salary configuration"
                                >
                                  {s.salaryConfig.model === 'FIXED' ? (
                                    <>
                                      <Wallet size={12} className="text-indigo-400" />
                                      <span>Fixed: Rs. {(Number(s.salaryConfig.fixedAmount) || 0).toLocaleString()}</span>
                                    </>
                                  ) : s.salaryConfig.commissionType === 'PER_STUDENT' ? (
                                    <>
                                      <Users size={12} className="text-cyan-400" />
                                      <span>Rs. {(Number(s.salaryConfig.perStudentRate) || 0).toLocaleString()}/stu</span>
                                    </>
                                  ) : (
                                    <>
                                      <Percent size={12} className="text-emerald-400" />
                                      <span>{s.salaryConfig.commissionRate}% Comm</span>
                                    </>
                                  )}
                                  {s.salaryConfig.whtRate > 0 && (
                                    <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                                      WHT {s.salaryConfig.whtRate}%
                                    </span>
                                  )}
                                  <Settings size={11} className="text-slate-400" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => openSalarySetup(s, bt, b, l)}
                                  className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-dashed border-purple-400/40 text-purple-300 hover:bg-purple-500/20 text-[11px] font-bold flex items-center gap-1 transition-all mx-auto"
                                  title="Set teacher salary model"
                                >
                                  <Plus size={12} />
                                  <span>Set Model</span>
                                </button>
                              )}
                            </td>

                            {/* Teacher Salary */}
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              <div className="font-black text-emerald-400 text-xs">
                                Rs. {(s.teacherSalary || 0).toLocaleString()}
                              </div>
                              {(s.whtAmount || 0) > 0 && (
                                <div className="text-[9.5px] text-amber-400 font-semibold mt-0.5 whitespace-nowrap">
                                  Gross: Rs. {(s.grossSalary || 0).toLocaleString()} (WHT -Rs. {(s.whtAmount || 0).toLocaleString()})
                                </div>
                              )}
                              {(s.teacherSalary || 0) > 0 && (
                                <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                  Inst: Rs. {(s.instituteShare || 0).toLocaleString()}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* LECTURER SALARY STATEMENT PRINT MODAL */}
      {showPrintModal && selectedLecturerForPrint && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#181d2e] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 md:p-8 relative">
            <button
              onClick={() => setShowPrintModal(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X size={18} />
            </button>

            {/* PRINTABLE CONTENT */}
            <div ref={printRef} className="space-y-6">
              {/* VOUCHER HEADER */}
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <h2 className="text-2xl font-black text-white">IMA CAMPUS</h2>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                    Teacher Salary & Student Enrollment Statement
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-purple-400">
                    Statement Date: {new Date().toLocaleDateString()}
                  </span>
                  <p className="text-[11px] text-slate-400 font-semibold">
                    Billing Cycle: {activeCycle?.cycleText || activeCycle?.label || selectedBillingMonth}
                  </p>
                </div>
              </div>

              {/* TEACHER INFO BOX */}
              <div className="bg-black/30 p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Lecturer Name</p>
                  <p className="text-lg font-black text-white mt-0.5">{selectedLecturerForPrint.name}</p>
                </div>
                <div className="flex flex-wrap items-center gap-6 text-right">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold">Total Approved</p>
                    <p className="text-lg font-black text-emerald-400">
                      {(selectedLecturerForPrint?.totalApproved || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold">Monthly / Full</p>
                    <p className="text-lg font-black text-purple-300">
                      {selectedLecturerForPrint.monthlyCount} / {selectedLecturerForPrint.fullCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold text-blue-300">Gross Earnings</p>
                    <p className="text-lg font-black text-blue-300">
                      Rs. {(selectedLecturerForPrint.grossSalary || 0).toLocaleString()}
                    </p>
                  </div>
                  {(selectedLecturerForPrint.whtAmount || 0) > 0 && (
                    <div>
                      <p className="text-xs text-slate-400 uppercase font-bold text-amber-400">WHT Deducted</p>
                      <p className="text-lg font-black text-amber-400">
                        -Rs. {(selectedLecturerForPrint.whtAmount || 0).toLocaleString()}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-bold text-emerald-400">Net Salary Payable</p>
                    <p className="text-lg font-black text-emerald-400">
                      Rs. {(selectedLecturerForPrint.teacherSalary || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* DETAILED STATEMENTS TABLE */}
              <div className="space-y-4">
                {selectedLecturerForPrint.businesses?.map((b) => (
                  <div key={b.id} className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-purple-300">
                      Business: {b.name}
                    </h5>
                    {b.batches?.map((bt) => (
                      <div key={bt.id} className="bg-black/40 rounded-xl border border-white/5 p-3">
                        <p className="text-xs font-semibold text-slate-300 mb-2">
                          Batch: {bt.name}
                        </p>
                        <table className="w-full text-xs text-left">
                          <thead className="text-[10px] uppercase text-slate-500 border-b border-white/5">
                            <tr>
                              <th className="pb-1.5">Subject</th>
                              <th className="pb-1.5">Plan</th>
                              <th className="pb-1.5 text-right">Monthly</th>
                              <th className="pb-1.5 text-right">Full</th>
                              <th className="pb-1.5 text-right">Upgrade</th>
                              <th className="pb-1.5 text-right">Installment</th>
                              <th className="pb-1.5 text-right">Adjusted</th>
                              <th className="pb-1.5 text-right">Approved</th>
                              <th className="pb-1.5 text-right">Revenue</th>
                              <th className="pb-1.5 text-center">Model</th>
                              <th className="pb-1.5 text-right">Gross (Rs.)</th>
                              <th className="pb-1.5 text-right">WHT</th>
                              <th className="pb-1.5 text-right">Net Salary (Rs.)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {bt.subjects?.map((s) => (
                              <tr key={s.id}>
                                <td className="py-1.5 font-bold text-white">{s.name}</td>
                                <td className="py-1.5 text-slate-300">{s.groupName || s.groupType}</td>
                                <td className="py-1.5 text-right text-blue-300">
                                  {s.monthlyCount} <span className="text-[10px] text-blue-400 font-semibold">(Rs. {Math.round(s.monthlyAmount || 0).toLocaleString()})</span>
                                </td>
                                <td className="py-1.5 text-right text-purple-300">
                                  {s.fullCount} <span className="text-[10px] text-purple-400 font-semibold">(Rs. {Math.round(s.fullAmount || 0).toLocaleString()})</span>
                                </td>
                                <td className="py-1.5 text-right text-rose-300">
                                  {s.upgradeCount || 0} <span className="text-[10px] text-rose-400 font-semibold">(Rs. {Math.round(s.upgradeAmount || 0).toLocaleString()})</span>
                                </td>
                                <td className="py-1.5 text-right text-fuchsia-300">
                                  {(s.installmentCount || s.mixCount || 0)} <span className="text-[10px] text-fuchsia-400 font-semibold">(Rs. {Math.round(s.installmentAmount || s.mixAmount || 0).toLocaleString()})</span>
                                </td>
                                <td className="py-1.5 text-right text-amber-300">
                                  {s.adjustedCount}
                                  {(s.adjustedAmount || 0) > 0 && (
                                    <span className="text-[10px] text-amber-400 font-semibold ml-1">
                                      (Rs. {Math.round(s.adjustedAmount || 0).toLocaleString()})
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 text-right text-emerald-400 font-bold">{s.totalApproved}</td>
                                <td className="py-1.5 text-right text-teal-300 font-bold">Rs. {(Math.round(s.totalAmount || 0)).toLocaleString()}</td>
                                <td className="py-1.5 text-center text-slate-300 text-[10px] font-semibold">
                                  {s.salaryConfig ? (
                                    s.salaryConfig.model === 'FIXED' 
                                      ? `Fixed (Rs. ${(Number(s.salaryConfig.fixedAmount) || 0).toLocaleString()})`
                                      : s.salaryConfig.commissionType === 'PER_STUDENT'
                                      ? `Rs. ${s.salaryConfig.perStudentRate}/stu`
                                      : `${s.salaryConfig.commissionRate}%`
                                  ) : 'Default'}
                                </td>
                                <td className="py-1.5 text-right text-blue-300 font-bold whitespace-nowrap">
                                  Rs. {Math.round(s.grossSalary || 0).toLocaleString()}
                                </td>
                                <td className="py-1.5 text-right text-amber-400 font-bold whitespace-nowrap">
                                  {(s.whtAmount || 0) > 0 ? `-Rs. ${Math.round(s.whtAmount).toLocaleString()}` : '-'}
                                </td>
                                <td className="py-1.5 text-right text-emerald-400 font-black whitespace-nowrap">
                                  Rs. {(s.teacherSalary || 0).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              {/* SIGNATURE SECTION */}
              <div className="pt-8 border-t border-white/10 grid grid-cols-3 gap-6 text-center text-xs text-slate-400">
                <div className="border-t border-dashed border-white/20 pt-2">
                  <p className="font-semibold text-slate-300">Prepared By</p>
                  <p className="text-[10px] text-slate-500">Finance Department</p>
                </div>
                <div className="border-t border-dashed border-white/20 pt-2">
                  <p className="font-semibold text-slate-300">Verified By</p>
                  <p className="text-[10px] text-slate-500">General Management</p>
                </div>
                <div className="border-t border-dashed border-white/20 pt-2">
                  <p className="font-semibold text-slate-300">Lecturer Acknowledgement</p>
                  <p className="text-[10px] text-slate-500">{selectedLecturerForPrint.name}</p>
                </div>
              </div>
            </div>

            {/* MODAL ACTIONS */}
            <div className="mt-8 flex items-center justify-end gap-3 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={() => setShowPrintModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={executePrint}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30"
              >
                <Printer size={15} />
                <span>Print Statement</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEACHER SALARY SETUP MODAL */}
      {salaryModalOpen && selectedSubjectForSalary && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#181d2e] border border-white/10 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6 md:p-8 relative">
            <button
              onClick={() => setSalaryModalOpen(false)}
              className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            {/* MODAL HEADER */}
            <div className="flex items-center gap-4 mb-6">
              <TeacherAvatar
                image={selectedSubjectForSalary.lecturer.image}
                name={selectedSubjectForSalary.lecturer.name}
                size="w-14 h-14"
                textSize="text-lg"
              />
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  Teacher Salary Setup
                </span>
                <h3 className="text-xl font-black text-white mt-1">
                  {selectedSubjectForSalary.lecturer.name}
                </h3>
                <p className="text-xs text-slate-400 font-medium">
                  {selectedSubjectForSalary.batch.name} • <span className="text-purple-300 font-bold">{selectedSubjectForSalary.subject.name}</span>
                  {(selectedSubjectForSalary.subject.classType === 2 || selectedSubjectForSalary.subject.isPaperClass) && (
                    <span className="ml-2 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[10px] font-bold">
                      📝 Paper Class
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* ACTIVE METRICS SNAPSHOT */}
            <div className="bg-black/40 rounded-2xl p-4 border border-white/5 grid grid-cols-3 gap-3 mb-6 text-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cycle Period</p>
                <p className="text-xs font-black text-slate-200 mt-0.5 truncate">
                  {activeCycle?.label || selectedBillingMonth}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid Students</p>
                <p className="text-xs font-black text-emerald-400 mt-0.5">
                  {(selectedSubjectForSalary?.subject?.totalApproved || 0).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Apportioned Rev</p>
                <p className="text-xs font-black text-teal-300 mt-0.5">
                  Rs. {(selectedSubjectForSalary?.subject?.totalAmount || 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* STEP 1: PAYMENT MODEL SELECTION */}
            <div className="space-y-4 mb-6">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders size={14} className="text-purple-400" />
                <span>Select Payment Model (ගෙවීම් ක්‍රමය තෝරන්න)</span>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* CARD 1: COMMISSION BASED */}
                <div
                  onClick={() => setFormModel('COMMISSION')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    formModel === 'COMMISSION'
                      ? 'bg-gradient-to-br from-emerald-950/40 to-[#1e2336] border-emerald-500/60 shadow-lg shadow-emerald-500/10'
                      : 'bg-black/30 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${formModel === 'COMMISSION' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400'}`}>
                        <Percent size={18} />
                      </div>
                      <span className="text-sm font-black text-white">Commission Based</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formModel === 'COMMISSION' ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/20'}`}>
                      {formModel === 'COMMISSION' && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Percentage (%) of fee revenue or fixed rate per paid student.
                  </p>
                </div>

                {/* CARD 2: FIXED PAYMENT */}
                <div
                  onClick={() => setFormModel('FIXED')}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                    formModel === 'FIXED'
                      ? 'bg-gradient-to-br from-indigo-950/40 to-[#1e2336] border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                      : 'bg-black/30 border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded-xl ${formModel === 'FIXED' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/5 text-slate-400'}`}>
                        <Wallet size={18} />
                      </div>
                      <span className="text-sm font-black text-white">Fixed Payment</span>
                    </div>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${formModel === 'FIXED' ? 'border-indigo-400 bg-indigo-500 text-white' : 'border-white/20'}`}>
                      {formModel === 'FIXED' && <Check size={12} strokeWidth={3} />}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Fixed pre-agreed amount for this batch, regardless of student count.
                  </p>
                </div>
              </div>
            </div>

            {/* STEP 2: RATES / INPUTS */}
            <div className="bg-black/30 p-5 rounded-2xl border border-white/5 mb-6 space-y-4">
              {formModel === 'COMMISSION' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Commission Calculation Type:</span>
                    <div className="flex items-center gap-2 bg-black/60 p-1 rounded-xl border border-white/10 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setFormCommissionType('PERCENTAGE')}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          formCommissionType === 'PERCENTAGE'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Revenue %
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormCommissionType('PER_STUDENT')}
                        className={`px-3 py-1 rounded-lg transition-all ${
                          formCommissionType === 'PER_STUDENT'
                            ? 'bg-cyan-600 text-white shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Per Student (Rs.)
                      </button>
                    </div>
                  </div>

                  {formCommissionType === 'PERCENTAGE' ? (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-300">
                          Teacher Commission Percentage (%)
                        </label>
                        <span className="text-xs font-black text-emerald-400">{formCommissionRate}% Teacher / {Math.max(0, 100 - (parseFloat(formCommissionRate) || 0))}% Institute</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={formCommissionRate}
                          onChange={(e) => setFormCommissionRate(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-emerald-500"
                          placeholder="e.g. 70"
                        />
                        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Default standard is 70% for teacher and 30% retained by institute.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">
                        Rate per Paid Student (Rs.)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs.</span>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          value={formPerStudentRate}
                          onChange={(e) => setFormPerStudentRate(e.target.value)}
                          className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-cyan-500"
                          placeholder="e.g. 1500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1.5">
                        Multiplied by approved paid students count ({selectedSubjectForSalary.subject.totalApproved}).
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">
                    Fixed Batch Amount (Rs.) - ස්ථාවර Batch මුදල
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">Rs.</span>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formFixedAmount}
                      onChange={(e) => setFormFixedAmount(e.target.value)}
                      className="w-full bg-black/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. 100000"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    Fixed payment amount for this batch for the billing cycle.
                  </p>
                </div>
              )}

              {/* WITHHOLDING TAX (WHT / AIT) SECTION */}
              <div className="bg-black/40 p-4 rounded-2xl border border-amber-500/20 space-y-2.5 mt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Percent size={13} className="text-amber-400" />
                    <span>Withholding Tax (WHT / AIT) Rate (%)</span>
                  </label>
                  <span className="text-[10px] text-amber-400/90 font-bold uppercase tracking-wider">
                    {parseFloat(formWhtRate) > 0 ? `Deducting ${formWhtRate}% from Gross` : 'No Tax Deducted (0%)'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={formWhtRate}
                      onChange={(e) => setFormWhtRate(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
                      placeholder="e.g. 5"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { rate: '0', label: '0% (None)' },
                      { rate: '5', label: '5% (Service)' },
                      { rate: '10', label: '10%' },
                      { rate: '14', label: '14%' }
                    ].map((p) => {
                      const isSelected = String(formWhtRate) === p.rate;
                      return (
                        <button
                          key={p.rate}
                          type="button"
                          onClick={() => setFormWhtRate(p.rate)}
                          className={`px-2.5 py-2 rounded-xl text-xs font-bold transition-all ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 shadow-md font-black ring-1 ring-amber-300'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Under Inland Revenue regulations, Service/Lecturer fee WHT is deducted from gross teacher salary before net payment.
                </p>
              </div>
            </div>

            {/* LIVE CALCULATION PREVIEW BOX */}
            <div className="bg-gradient-to-br from-[#121927] to-[#1a1c30] p-4 rounded-2xl border border-purple-500/20 mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                  <Sparkles size={12} className="text-purple-400" />
                  <span>Live Payout Preview</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{modalLivePreview.formula}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/5">
                <div className="bg-blue-950/30 p-2.5 rounded-xl border border-blue-500/30">
                  <span className="text-[9px] font-bold uppercase text-blue-400">Teacher Gross</span>
                  <p className="text-base font-black text-blue-300 mt-0.5">
                    Rs. {(modalLivePreview?.grossSalary || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-amber-950/30 p-2.5 rounded-xl border border-amber-500/30">
                  <span className="text-[9px] font-bold uppercase text-amber-400">WHT ({modalLivePreview.whtRate}%)</span>
                  <p className="text-base font-black text-amber-300 mt-0.5">
                    -Rs. {(modalLivePreview?.whtAmount || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-emerald-950/30 p-2.5 rounded-xl border border-emerald-500/30">
                  <span className="text-[9px] font-bold uppercase text-emerald-400">Net Teacher Payout</span>
                  <p className="text-base font-black text-emerald-300 mt-0.5">
                    Rs. {(modalLivePreview?.netSalary || 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-purple-950/30 p-2.5 rounded-xl border border-purple-500/30">
                  <span className="text-[9px] font-bold uppercase text-purple-400">Institute Retained</span>
                  <p className="text-base font-black text-purple-300 mt-0.5">
                    Rs. {(modalLivePreview?.instituteShare || 0).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* OPTION: APPLY TO ALL BATCHES */}
            <div className="flex items-center gap-2 mb-6 px-1">
              <input
                type="checkbox"
                id="applyAllBatchesCheckbox"
                checked={formApplyToAllBatches}
                onChange={(e) => setFormApplyToAllBatches(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-black/40 text-purple-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="applyAllBatchesCheckbox" className="text-xs text-slate-300 font-semibold cursor-pointer select-none">
                Apply this salary model to all batches of {selectedSubjectForSalary.subject.name} for {selectedSubjectForSalary.lecturer.name}
              </label>
            </div>

            {/* MODAL ACTIONS */}
            <div className="flex items-center justify-between border-t border-white/10 pt-5">
              <div>
                {selectedSubjectForSalary.subject.salaryConfig && (
                  <button
                    type="button"
                    disabled={savingSalary}
                    onClick={handleResetSalaryConfig}
                    className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all"
                  >
                    Reset to Default
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={savingSalary}
                  onClick={() => setSalaryModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingSalary}
                  onClick={handleSaveSalaryConfig}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
                >
                  {savingSalary ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  <span>Save Configuration</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 STEP 1: PRE-SLIP ADJUSTMENT & SETTLEMENT MODAL (DEDUCTIONS, ADDITIONS, VIEW MODE) 🔥 */}
      {preSlipModalOpen && preSlipData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-[#131726] border border-white/10 rounded-3xl max-w-4xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* TOP BAR */}
            <div className="px-5 py-3.5 bg-black/60 border-b border-white/10 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  <Sliders size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm md:text-base font-black text-white">
                      Salary Slip Adjustments & Settlement
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-black uppercase">
                      Pre-Slip Step
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {preSlipData.lecturer?.name} • {preSlipData.isConsolidated ? `${preSlipData.batchesCount} Batches Consolidated (${preSlipData.business?.name})` : preSlipData.batch?.name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPreSlipModalOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* MODAL BODY */}
            {(() => {
              const manualBatches = preSlipData.manualBatches || [];
              const manualBatchesStu = manualBatches.reduce((s, b) => s + (parseInt(b.studentCount) || 0), 0);
              const manualBatchesGross = manualBatches.reduce((s, b) => s + (parseFloat(b.grossAmount) || 0), 0);
              const manualBatchesWht = manualBatches.reduce((s, b) => s + (parseFloat(b.whtAmount) || 0), 0);
              const manualBatchesNet = manualBatches.reduce((s, b) => s + (parseFloat(b.netAmount) || ((parseFloat(b.grossAmount) || 0) - (parseFloat(b.whtAmount) || 0))), 0);

              const baseTotalApproved = (preSlipData.baseSubtotalAdj?.totalApproved ?? preSlipData.subtotalAdj?.totalApproved ?? 0);
              const baseGrossSalary = (preSlipData.baseSubtotalAdj?.grossSalary ?? preSlipData.subtotalAdj?.grossSalary ?? 0);
              const baseNetSalary = (preSlipData.baseSubtotalAdj?.teacherSalary ?? preSlipData.subtotalAdj?.teacherSalary ?? 0);

              const liveTotalApproved = baseTotalApproved + manualBatchesStu;
              const liveGrossSalary = baseGrossSalary + manualBatchesGross;
              const liveBaseNetSalary = baseNetSalary + manualBatchesNet;

              const totalAdditions = (preSlipData.additions || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
              const totalDeductions = (preSlipData.deductions || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
              const finalNetPayable = Math.max(0, liveBaseNetSalary + totalAdditions - totalDeductions);

              return (
                <div className="p-4 md:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
                  {/* SNAPSHOT KPI BAR */}
                  <div className="bg-black/40 rounded-2xl p-4 border border-white/5 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Billing Period</p>
                      <p className="text-xs font-black text-slate-200 mt-0.5 truncate">
                        {activeCycle?.label || selectedBillingMonth}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Paid Students</p>
                      <p className="text-xs font-black text-emerald-400 mt-0.5">
                        {liveTotalApproved} Students
                        {manualBatchesStu > 0 && <span className="text-[10px] text-cyan-400 font-bold ml-1">(+{manualBatchesStu} manual)</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gross Remuneration</p>
                      <p className="text-xs font-black text-teal-300 mt-0.5">
                        Rs. {liveGrossSalary.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Base Net Salary</p>
                      <p className="text-xs font-black text-purple-300 mt-0.5">
                        Rs. {liveBaseNetSalary.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* SECTION 1: DEDUCTIONS (අඩු කිරීම් - LOAN, SALARY ADVANCE, ETC.) */}
                  <div className="bg-rose-950/20 border border-rose-500/30 rounded-2xl p-4 md:p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-rose-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <MinusCircle size={16} className="text-rose-400" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-rose-300">
                            1. Deductions (අඩු කිරීම් - Loan, Salary Advance, Fees)
                          </h4>
                          <p className="text-[10.5px] text-slate-400">
                            Enter any loan installments, salary advances, or material costs to subtract from net payout.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-rose-400">
                          Total: -Rs. {((preSlipData.deductions || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0)).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* QUICK PRESETS FOR DEDUCTIONS */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Add:</span>
                      {[
                        { label: 'Salary Advance (අත්තිකාරම්)', desc: 'Salary Advance' },
                        { label: 'Staff Loan (ණය මුදල්)', desc: 'Loan Installment' },
                        { label: 'Tute Fees (ටියුට් ගාස්තු)', desc: 'Tute Deduction' },
                        { label: 'Penalty / Other (වෙනත්)', desc: 'Adjustment Deduction' }
                      ].map(preset => (
                        <button
                          key={preset.desc}
                          type="button"
                          onClick={() => handleAddPreSlipDeduction(preset.desc)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus size={11} />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* DEDUCTIONS TABLE / ROWS */}
                    <div className="space-y-2 pt-1">
                      {(!preSlipData.deductions || preSlipData.deductions.length === 0) ? (
                        <div className="p-3 bg-black/30 rounded-xl border border-dashed border-rose-500/30 text-center text-xs text-slate-400 font-medium">
                          No deductions added. Click a quick preset or the button below to add a deduction.
                        </div>
                      ) : (
                        preSlipData.deductions.map((item, idx) => (
                          <div key={item.id || idx} className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-rose-500/20">
                            <span className="text-[11px] font-bold text-rose-400 w-6 text-center">#{idx + 1}</span>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdatePreSlipDeduction(idx, 'description', e.target.value)}
                              placeholder="Description (e.g. Salary Advance, Staff Loan)"
                              className="flex-1 bg-slate-900/90 border border-white/10 focus:border-rose-400 rounded-lg px-3 py-1.5 text-xs text-white font-semibold outline-none"
                            />
                            <div className="relative w-36 md:w-44">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-400">Rs.</span>
                              <input
                                type="number"
                                min="0"
                                value={item.amount}
                                onChange={(e) => handleUpdatePreSlipDeduction(idx, 'amount', e.target.value)}
                                placeholder="Amount"
                                className="w-full bg-slate-900/90 border border-rose-500/40 focus:border-rose-400 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-bold text-rose-300 outline-none text-right"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePreSlipDeduction(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remove Deduction"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}

                      <button
                        type="button"
                        onClick={() => handleAddPreSlipDeduction('')}
                        className="w-full py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-dashed border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add Custom Deduction</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 2: ADDITIONS (එකතු කිරීම් - ALLOWANCES, PAPER MARKING, ETC.) */}
                  <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-2xl p-4 md:p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <PlusCircle size={16} className="text-emerald-400" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-emerald-300">
                            2. Additions (දීමනා - Paper Marking, Bonus, Extra Discussion)
                          </h4>
                          <p className="text-[10.5px] text-slate-400">
                            Add special allowances or student-count based payments to add to net payout.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-emerald-400">
                          Total: +Rs. {totalAdditions.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* QUICK PRESETS FOR ADDITIONS */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Add:</span>
                      {[
                        { label: 'Paper Marking (පේපර් බැලීම)', desc: 'Paper Marking Fee' },
                        { label: 'Special Allowance (විශේෂ දීමනා)', desc: 'Special Allowance' },
                        { label: 'Extra Discussion (අමතර සාකච්ඡා)', desc: 'Extra Discussion Payment' },
                        { label: 'Bonus (බෝනස්)', desc: 'Performance Bonus' }
                      ].map(preset => (
                        <button
                          key={preset.desc}
                          type="button"
                          onClick={() => handleAddPreSlipAddition(preset.desc)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus size={11} />
                          <span>{preset.label}</span>
                        </button>
                      ))}
                    </div>

                    {/* ADDITIONS TABLE / ROWS */}
                    <div className="space-y-2 pt-1">
                      {(!preSlipData.additions || preSlipData.additions.length === 0) ? (
                        <div className="p-3 bg-black/30 rounded-xl border border-dashed border-emerald-500/30 text-center text-xs text-slate-400 font-medium">
                          No additions added. Click a quick preset or the button below to add an addition.
                        </div>
                      ) : (
                        preSlipData.additions.map((item, idx) => (
                          <div key={item.id || idx} className="flex flex-wrap md:flex-nowrap items-center gap-2 bg-black/40 p-2 rounded-xl border border-emerald-500/20">
                            <span className="text-[11px] font-bold text-emerald-400 w-6 text-center">#{idx + 1}</span>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => handleUpdatePreSlipAddition(idx, 'description', e.target.value)}
                              placeholder="Description (e.g. Paper Marking Fee, Extra Session)"
                              className="flex-1 bg-slate-900/90 border border-white/10 focus:border-emerald-400 rounded-lg px-3 py-1.5 text-xs text-white font-semibold outline-none min-w-[180px]"
                            />
                            {/* STUDENT COUNT (OPTIONAL) */}
                            <div className="relative w-28 md:w-32">
                              <input
                                type="number"
                                min="0"
                                value={item.studentCount}
                                onChange={(e) => handleUpdatePreSlipAddition(idx, 'studentCount', e.target.value)}
                                placeholder="Stu Qty"
                                className="w-full bg-slate-900/90 border border-cyan-500/40 focus:border-cyan-400 rounded-lg px-2.5 py-1.5 text-xs font-bold text-cyan-300 outline-none text-center"
                                title="Optional student count for this addition"
                              />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 pointer-events-none">stu</span>
                            </div>
                            {/* AMOUNT (RS.) */}
                            <div className="relative w-36 md:w-40">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">Rs.</span>
                              <input
                                type="number"
                                min="0"
                                value={item.amount}
                                onChange={(e) => handleUpdatePreSlipAddition(idx, 'amount', e.target.value)}
                                placeholder="Amount"
                                className="w-full bg-slate-900/90 border border-emerald-500/40 focus:border-emerald-400 rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-bold text-emerald-300 outline-none text-right"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePreSlipAddition(idx)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Remove Addition"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}

                      <button
                        type="button"
                        onClick={() => handleAddPreSlipAddition('')}
                        className="w-full py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-dashed border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add Custom Addition</span>
                      </button>
                    </div>
                  </div>

                  {/* 🔥 SECTION 3: MANUAL BATCH REMUNERATION ADDITIONS (ශිෂ්‍ය ගණන සහ WHT සහිත BATCH ආදායම් එකතු කිරීම්) 🔥 */}
                  <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-4 md:p-5 space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase size={16} className="text-indigo-400" />
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                            <span>3. Manual Batch Additions (ශිෂ්‍ය ගණන සහ WHT සහිත Batch ආදායම්)</span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/40 text-indigo-300 text-[9.5px] font-black uppercase">
                              Voucher Table Rows
                            </span>
                          </h4>
                          <p className="text-[10.5px] text-slate-400">
                            Add manual batch payments with student count and WHT. Unlike other allowances, these rows appear directly in the official Salary Slip Voucher Table.
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-indigo-300 block">
                          Total Net: +Rs. {manualBatchesNet.toLocaleString()}
                        </span>
                        {(manualBatchesStu > 0 || manualBatchesGross > 0) && (
                          <span className="text-[10px] text-slate-400 block font-semibold">
                            {manualBatchesStu} Stu • Gross: Rs. {manualBatchesGross.toLocaleString()} {manualBatchesWht > 0 ? `• WHT: -Rs. ${manualBatchesWht.toLocaleString()}` : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* QUICK BATCH PRESETS FROM CURRENT BUSINESS */}
                    {preSlipData.business?.batches && preSlipData.business.batches.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Quick Add Batch:</span>
                        {preSlipData.business.batches.slice(0, 5).map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => handleAddPreSlipManualBatch(b.name)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <Plus size={11} />
                            <span className="truncate max-w-[150px]">{b.name}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => handleAddPreSlipManualBatch('Special Seminar / Revision')}
                          className="px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-cyan-300 border border-indigo-500/30 text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <Plus size={11} />
                          <span>Special Seminar</span>
                        </button>
                      </div>
                    )}

                    {/* MANUAL BATCHES LIST / CARDS */}
                    <div className="space-y-3 pt-1">
                      {(!preSlipData.manualBatches || preSlipData.manualBatches.length === 0) ? (
                        <div className="p-3.5 bg-black/30 rounded-xl border border-dashed border-indigo-500/30 text-center text-xs text-slate-400 font-medium space-y-1">
                          <p>No manual batch incomes added. Click a quick batch above or click below to add one.</p>
                          <p className="text-[10px] text-slate-500">වෙනත් දීමනා (Section 2) මෙන් නොව, මේවා ඍජුවම Batch Income Voucher Table එකට Gross, Paid Students සහ WHT සහිතව ඇතුළත් වේ.</p>
                        </div>
                      ) : (
                        preSlipData.manualBatches.map((item, idx) => (
                          <div key={item.id || idx} className="bg-black/40 p-3 rounded-2xl border border-indigo-500/30 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2">
                              <span className="text-[11px] font-black text-indigo-400 flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[10px]">#{idx + 1}</span>
                                <span>Manual Batch Entry</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemovePreSlipManualBatch(idx)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remove this batch"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                              {/* BATCH NAME (md:col-span-6) */}
                              <div className="md:col-span-6">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Batch Name *
                                </label>
                                <input
                                  type="text"
                                  list={`batch-suggestions-${idx}`}
                                  value={item.batchName}
                                  onChange={(e) => handleUpdatePreSlipManualBatch(idx, 'batchName', e.target.value)}
                                  placeholder="e.g. 2026 A/L Revision / Special Seminar"
                                  className="w-full bg-slate-900/90 border border-indigo-500/40 focus:border-indigo-400 rounded-xl px-3 py-1.5 text-xs text-white font-bold outline-none"
                                />
                                <datalist id={`batch-suggestions-${idx}`}>
                                  {(preSlipData.business?.batches || []).map(b => (
                                    <option key={b.id} value={b.name} />
                                  ))}
                                  <option value="Special Seminar / Workshop" />
                                  <option value="Paper Class Examination" />
                                  <option value="Revision Batch" />
                                </datalist>
                              </div>

                              {/* SUBJECT NAME (md:col-span-4) */}
                              <div className="md:col-span-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Subject / Module
                                </label>
                                <input
                                  type="text"
                                  value={item.subjectName}
                                  onChange={(e) => handleUpdatePreSlipManualBatch(idx, 'subjectName', e.target.value)}
                                  placeholder="e.g. Theory / Paper / Revision"
                                  className="w-full bg-slate-900/90 border border-white/10 focus:border-indigo-400 rounded-xl px-3 py-1.5 text-xs text-slate-200 font-semibold outline-none"
                                />
                              </div>

                              {/* STUDENT COUNT (md:col-span-2) */}
                              <div className="md:col-span-2">
                                <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block mb-1">
                                  Paid Stu *
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.studentCount}
                                    onChange={(e) => handleUpdatePreSlipManualBatch(idx, 'studentCount', e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-900/90 border border-cyan-500/40 focus:border-cyan-400 rounded-xl pl-2.5 pr-7 py-1.5 text-xs font-black text-cyan-300 outline-none text-right"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">stu</span>
                                </div>
                              </div>
                            </div>

                            {/* ROW 2: GROSS, WHT %, WHT RS, NET SALARY */}
                            <div className="grid grid-cols-2 md:grid-cols-12 gap-2.5 pt-1 border-t border-white/5 items-center">
                              {/* GROSS AMOUNT (md:col-span-4) */}
                              <div className="col-span-2 md:col-span-4">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                  Gross Remuneration (Rs.) *
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-indigo-400">Rs.</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.grossAmount}
                                    onChange={(e) => handleUpdatePreSlipManualBatch(idx, 'grossAmount', e.target.value)}
                                    placeholder="Gross Amount"
                                    className="w-full bg-slate-900/90 border border-indigo-500/40 focus:border-indigo-400 rounded-xl pl-8 pr-2.5 py-1.5 text-xs font-black text-indigo-200 outline-none text-right"
                                  />
                                </div>
                              </div>

                              {/* WHT RATE % (md:col-span-2) */}
                              <div className="col-span-1 md:col-span-2">
                                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                                  WHT Rate (%)
                                </label>
                                <div className="relative">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.5"
                                    value={item.whtRate}
                                    onChange={(e) => handleUpdatePreSlipManualBatch(idx, 'whtRate', e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-slate-900/90 border border-amber-500/40 focus:border-amber-400 rounded-xl pl-2.5 pr-6 py-1.5 text-xs font-black text-amber-300 outline-none text-right"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-amber-400 pointer-events-none">%</span>
                                </div>
                              </div>

                              {/* WHT AMOUNT RS (md:col-span-3) */}
                              <div className="col-span-1 md:col-span-3">
                                <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                                  WHT Deducted (Rs.)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">-Rs.</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={item.whtAmount}
                                    onChange={(e) => handleUpdatePreSlipManualBatch(idx, 'whtAmount', e.target.value)}
                                    placeholder="WHT Rs."
                                    className="w-full bg-slate-900/90 border border-amber-500/40 focus:border-amber-400 rounded-xl pl-9 pr-2.5 py-1.5 text-xs font-black text-amber-300 outline-none text-right"
                                  />
                                </div>
                              </div>

                              {/* NET SALARY (md:col-span-3) */}
                              <div className="col-span-2 md:col-span-3">
                                <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                                  Net Remuneration (Rs.)
                                </label>
                                <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-right truncate">
                                  <span className="text-xs font-black text-emerald-300">
                                    Rs. {Math.round(item.netAmount || ((parseFloat(item.grossAmount) || 0) - (parseFloat(item.whtAmount) || 0))).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}

                      <button
                        type="button"
                        onClick={() => handleAddPreSlipManualBatch('')}
                        className="w-full py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-dashed border-indigo-500/40 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus size={14} />
                        <span>Add Manual Batch Remuneration (Batch + Student Count + WHT)</span>
                      </button>
                    </div>
                  </div>

                  {/* SECTION 4: VOUCHER BREAKDOWN VIEW MODE (MONTHLY/FULL VS JUST TOTAL STUDENTS) */}
                  <div className="bg-blue-950/20 border border-blue-500/30 rounded-2xl p-4 md:p-5 space-y-3.5">
                    <div className="flex items-center gap-2 border-b border-blue-500/20 pb-3">
                      <Layers size={16} className="text-blue-400" />
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-blue-300">
                          4. Voucher Table Layout Mode (ප්‍රදර්ශනය වන ආකාරය)
                        </h4>
                        <p className="text-[10.5px] text-slate-400">
                          Decide whether to show detailed breakdown categories (Monthly, Full, etc.) or just total student count.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                      {/* OPTION A: DETAILED BREAKDOWN */}
                      <div
                        onClick={() => setPreSlipData(prev => ({ ...prev, breakdownMode: 'DETAILED' }))}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          preSlipData.breakdownMode !== 'SIMPLE'
                            ? 'bg-blue-500/15 border-blue-400 shadow-md shadow-blue-500/10 ring-1 ring-blue-400'
                            : 'bg-black/30 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Layers size={15} className={preSlipData.breakdownMode !== 'SIMPLE' ? 'text-blue-400' : 'text-slate-400'} />
                            <span className="text-xs font-black text-white">Detailed Category Breakdown</span>
                          </div>
                          <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Default
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-400 leading-relaxed">
                          Displays full breakdown columns: <strong className="text-blue-300">Monthly, Full, Upgrade, Installment, Adjusted</strong> alongside Paid Students.
                        </p>
                      </div>

                      {/* OPTION B: SIMPLE TOTAL COUNT ONLY */}
                      <div
                        onClick={() => setPreSlipData(prev => ({ ...prev, breakdownMode: 'SIMPLE' }))}
                        className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                          preSlipData.breakdownMode === 'SIMPLE'
                            ? 'bg-emerald-500/15 border-emerald-400 shadow-md shadow-emerald-500/10 ring-1 ring-emerald-400'
                            : 'bg-black/30 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <Users size={15} className={preSlipData.breakdownMode === 'SIMPLE' ? 'text-emerald-400' : 'text-slate-400'} />
                            <span className="text-xs font-black text-white">Simple / Total Students Only</span>
                          </div>
                          <span className="text-[9.5px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Compact
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-400 leading-relaxed">
                          Hides payment category breakdowns. Displays only <strong className="text-emerald-300">Total Paid Students</strong>, Gross, WHT, and Net Salary.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* LIVE SETTLEMENT CALCULATION BAR */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 rounded-2xl p-4 md:p-5 border border-purple-500/30 flex flex-wrap items-center justify-between gap-4 shadow-xl">
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 font-semibold">Base Remuneration (Batches):</span>
                        <span className="text-white font-bold">Rs. {liveBaseNetSalary.toLocaleString()}</span>
                        {manualBatchesNet > 0 && (
                          <span className="text-[10px] font-bold text-indigo-300">
                            (incl. +Rs. {manualBatchesNet.toLocaleString()} manual batches)
                          </span>
                        )}
                      </div>
                      {totalAdditions > 0 && (
                        <div className="flex items-center gap-3 text-emerald-400 font-bold">
                          <span>(+) Allowances & Other Additions:</span>
                          <span>+Rs. {totalAdditions.toLocaleString()}</span>
                        </div>
                      )}
                      {totalDeductions > 0 && (
                        <div className="flex items-center gap-3 text-rose-400 font-bold">
                          <span>(-) Total Deductions:</span>
                          <span>-Rs. {totalDeductions.toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="text-right">
                      <p className="text-[10.5px] font-extrabold uppercase tracking-widest text-emerald-400">
                        Final Calculated Net Pay
                      </p>
                      <p className="text-2xl md:text-3xl font-black text-emerald-300 mt-0.5">
                        Rs. {finalNetPayable.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Will appear on official salary slip
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* MODAL FOOTER */}
            <div className="px-5 py-3.5 bg-black/60 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setPreSlipModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSavePreSlipAdjustmentsOnly}
                  disabled={savingPreSlipAdjustments}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-purple-300 hover:text-white text-xs font-bold flex items-center gap-1.5 border border-purple-500/40 hover:border-purple-300 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  title="Save deductions and view mode without previewing"
                >
                  {savingPreSlipAdjustments ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>Save Settings</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyPreSlipAndDownload}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
                  title="Direct Download Salary Slip PDF"
                >
                  <Download size={14} />
                  <span>Direct Download PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyPreSlipAndPreview}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95"
                  title="Preview Full Final Salary Slip Voucher"
                >
                  <Eye size={14} />
                  <span>Preview Final Slip</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 FINAL SALARY SLIP PREVIEW & DOWNLOAD MODAL 🔥 */}
      {finalSlipModalOpen && selectedFinalSlipData && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-fade-in">
          <div className="bg-[#131726] border border-white/10 rounded-3xl max-w-5xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
            {/* TOP BAR / MODAL CONTROLS */}
            <div className="px-5 py-3.5 bg-black/60 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <FileText size={18} />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-white flex items-center gap-2">
                    {selectedFinalSlipData.isConsolidated ? 'Consolidated Remuneration Voucher' : 'Final Teacher Salary Slip'}
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">
                      Official Voucher
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {selectedFinalSlipData.lecturer?.name} • {selectedFinalSlipData.isConsolidated ? `${selectedFinalSlipData.batchesCount} Batches Consolidated (${selectedFinalSlipData.business?.name})` : selectedFinalSlipData.batch?.name}
                  </p>
                </div>
              </div>

              {/* ACTION BUTTONS & TOGGLES */}
              <div className="flex items-center flex-wrap gap-2">
                {/* EDIT ADJUSTMENTS / PRE-SLIP TRIGGER */}
                <button
                  type="button"
                  onClick={() => {
                    setPreSlipData({ ...selectedFinalSlipData });
                    setFinalSlipModalOpen(false);
                    setPreSlipModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs font-bold flex items-center gap-1.5 border border-purple-500/40 transition-colors cursor-pointer"
                  title="Edit Deductions, Additions & Breakdown Mode"
                >
                  <Sliders size={13} />
                  <span>Edit Deductions & Mode</span>
                </button>

                {/* THEME TOGGLE */}
                <button
                  type="button"
                  onClick={() => setFinalSlipTheme(prev => prev === 'light' ? 'dark' : 'light')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                  title="Toggle Light / Dark Voucher Theme"
                >
                  <span>{finalSlipTheme === 'light' ? '📄 White Paper' : '🌙 Dark Theme'}</span>
                </button>

                {/* ORIENTATION TOGGLE */}
                <button
                  type="button"
                  onClick={() => setFinalSlipOrientation(prev => prev === 'landscape' ? 'portrait' : 'landscape')}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                  title="Toggle PDF Orientation"
                >
                  <span className="uppercase text-[10px]">{finalSlipOrientation}</span>
                </button>

                {/* PRINT BUTTON */}
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                  title="Print Salary Slip"
                >
                  <Printer size={14} />
                  <span>Print</span>
                </button>

                {/* DOWNLOAD PDF BUTTON */}
                <button
                  type="button"
                  disabled={downloadingFinalSlipPdf}
                  onClick={handleDownloadFinalSlipPdf}
                  className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                  title="Download Official Salary Slip PDF"
                >
                  {downloadingFinalSlipPdf ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  <span>Download PDF</span>
                </button>

                {/* CLOSE BUTTON */}
                <button
                  type="button"
                  onClick={() => setFinalSlipModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* VOUCHER PREVIEW CONTAINER (SCROLLABLE) */}
            <div className="p-4 md:p-8 overflow-y-auto flex-1 bg-black/40">
              <style>{`
                @media print {
                  body * {
                    visibility: hidden !important;
                  }
                  #final-salary-slip-printable, #final-salary-slip-printable * {
                    visibility: visible !important;
                  }
                  #final-salary-slip-printable {
                    position: fixed !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    padding: 10mm !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: #ffffff !important;
                    color: #000000 !important;
                  }
                  @page {
                    size: A4 portrait;
                    margin: 10mm;
                  }
                }
              `}</style>

              <div
                ref={finalSlipRef}
                id="final-salary-slip-printable"
                className={`w-full ${
                  finalSlipOrientation === 'portrait' ? 'max-w-[794px]' : 'max-w-4xl'
                } mx-auto rounded-2xl transition-colors duration-200 relative overflow-hidden ${
                  finalSlipTheme === 'light'
                    ? 'bg-white text-slate-900 border border-slate-300 shadow-xl'
                    : 'bg-[#0f172a] text-slate-100 border border-white/10 shadow-2xl'
                } p-6 md:p-9`}
              >
                {/* SUBTLE BRAND WATERMARK */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.03]">
                  <img
                    src="/logo.png"
                    alt=""
                    crossOrigin="anonymous"
                    className="w-96 max-w-full object-contain filter grayscale select-none"
                  />
                </div>

                {/* VOUCHER HEADER */}
                <div className={`relative z-10 flex flex-wrap items-start justify-between pb-5 border-b ${
                  finalSlipTheme === 'light' ? 'border-slate-200' : 'border-white/10'
                } gap-4`}>
                  <div className="flex items-center gap-3.5">
                    <img
                      src="/logo.png"
                      alt="IMA Campus Official Logo"
                      crossOrigin="anonymous"
                      className="h-14 md:h-16 w-auto object-contain shrink-0"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.style.display = 'none';
                      }}
                    />
                    <div>
                      <h2 className={`text-xl md:text-2xl font-black tracking-tight ${
                        finalSlipTheme === 'light' ? 'text-slate-950 font-black' : 'text-white font-black'
                      }`}>
                        IMA CAMPUS
                      </h2>
                      <p className={`text-[10px] font-extrabold uppercase tracking-widest ${
                        finalSlipTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Higher Academic & Professional Education
                      </p>
                      <p className={`text-[10.5px] font-semibold ${
                        finalSlipTheme === 'light' ? 'text-indigo-600 font-bold' : 'text-purple-400'
                      }`}>
                        Department of Academic Finance & Teacher Remuneration
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider inline-block ${
                      finalSlipTheme === 'light'
                        ? (selectedFinalSlipData.isConsolidated ? 'bg-purple-100 text-purple-900 border-purple-300' : 'bg-emerald-100 text-emerald-900 border-emerald-300')
                        : (selectedFinalSlipData.isConsolidated ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30')
                    }`}>
                      {selectedFinalSlipData.isConsolidated ? 'Consolidated Remuneration Voucher' : 'Official Remuneration Voucher'}
                    </span>
                    <p className={`text-xs font-mono font-bold mt-1.5 ${
                      finalSlipTheme === 'light' ? 'text-slate-600' : 'text-slate-300'
                    }`}>
                      Voucher No: IMA-PAY-{selectedFinalSlipData.isConsolidated ? `MULTI-${selectedFinalSlipData.business?.id}` : selectedFinalSlipData.batch?.id}-{Date.now().toString().slice(-5)}
                    </p>
                    <p className={`text-[11px] font-medium ${
                      finalSlipTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      Date Issued: {new Date().toLocaleDateString('en-GB')}
                    </p>
                    <p className={`text-[11px] font-semibold ${
                      finalSlipTheme === 'light' ? 'text-slate-700' : 'text-purple-300'
                    }`}>
                      Billing Period: {activeCycle?.label || selectedBillingMonth || 'Current Billing Cycle'}
                    </p>
                  </div>
                </div>

                {/* TEACHER & BATCH INFO CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-5 relative z-10">
                  {/* LECTURER CARD WITH PROFILE IMAGE */}
                  <div className={`p-3.5 rounded-xl border ${
                    finalSlipTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'
                  } flex items-center gap-3`}>
                    <TeacherAvatar
                      image={selectedFinalSlipData.lecturer?.image}
                      name={selectedFinalSlipData.lecturer?.name}
                      size="w-13 h-13"
                      textSize="text-sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[9px] font-extrabold uppercase tracking-wider ${
                        finalSlipTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                      }`}>
                        Lecturer Name
                      </p>
                      <p className={`text-sm font-black truncate mt-0.5 ${
                        finalSlipTheme === 'light' ? 'text-slate-950 font-black' : 'text-white'
                      }`} title={selectedFinalSlipData.lecturer?.name}>
                        {selectedFinalSlipData.lecturer?.name}
                      </p>
                      <p className={`text-[10.5px] font-medium truncate mt-0.5 ${
                        finalSlipTheme === 'light' ? 'text-slate-600' : 'text-slate-400'
                      }`} title={selectedFinalSlipData.business?.name}>
                        Business: <span className="font-bold">{selectedFinalSlipData.business?.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* BATCH CARD */}
                  <div className={`p-3.5 rounded-xl border ${
                    finalSlipTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-white/[0.02] border-white/5'
                  } flex flex-col justify-center`}>
                    <p className={`text-[9px] font-extrabold uppercase tracking-wider ${
                      finalSlipTheme === 'light' ? 'text-slate-500' : 'text-slate-400'
                    }`}>
                      {selectedFinalSlipData.isConsolidated ? `Academic Batches (${selectedFinalSlipData.batchesCount} Batches)` : 'Academic Batch'}
                    </p>
                    <p className={`text-sm font-black truncate mt-0.5 ${
                      finalSlipTheme === 'light' ? 'text-slate-950 font-black' : 'text-white'
                    }`} title={selectedFinalSlipData.batch?.name}>
                      {selectedFinalSlipData.batch?.name}
                    </p>
                    <p className={`text-[10.5px] font-medium truncate mt-0.5 ${
                      finalSlipTheme === 'light' ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      Mode: <span className="font-bold">{selectedFinalSlipData.isConsolidated ? 'Consolidated Multi-Batch Settlement' : (selectedFinalSlipData.modeLabel || 'Theory & Apportioned Modules')}</span>
                    </p>
                  </div>

                  {/* SETTLEMENT OVERVIEW (ONLY NON-ZERO BADGES) */}
                  <div className={`p-3.5 rounded-xl border ${
                    finalSlipTheme === 'light'
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                  } flex flex-col justify-center`}>
                    <p className={`text-[9px] font-extrabold uppercase tracking-wider ${
                      finalSlipTheme === 'light' ? 'text-emerald-800' : 'text-emerald-400'
                    }`}>
                      Total Paid Students
                    </p>
                    <p className={`text-xl font-black mt-0.5 ${
                      finalSlipTheme === 'light' ? 'text-emerald-700' : 'text-emerald-300'
                    }`}>
                      {(selectedFinalSlipData.subtotalAdj?.totalApproved || 0)} Students
                    </p>
                    {(() => {
                      const sub = selectedFinalSlipData.subtotalAdj || {};
                      const isSimpleMode = selectedFinalSlipData.breakdownMode === 'SIMPLE';
                      if (isSimpleMode) {
                        return (
                          <p className={`text-[10px] font-bold ${
                            finalSlipTheme === 'light' ? 'text-emerald-800' : 'text-emerald-400'
                          } mt-0.5 truncate`}>
                            Simple Total Student Mode
                          </p>
                        );
                      }
                      const badges = [
                        (sub.monthlyCount || 0) > 0 && `Monthly: ${sub.monthlyCount}`,
                        (sub.fullCount || 0) > 0 && `Full: ${sub.fullCount}`,
                        (sub.upgradeCount || 0) > 0 && `Upgrade: ${sub.upgradeCount}`,
                        ((sub.installmentCount || 0) > 0 || (sub.mixCount || 0) > 0) && `Installment: ${sub.installmentCount || sub.mixCount}`,
                        (sub.adjustedCount || 0) > 0 && `Adj: ${sub.adjustedCount}`,
                      ].filter(Boolean).join(' • ');
                      return badges ? (
                        <p className={`text-[10px] font-bold ${
                          finalSlipTheme === 'light' ? 'text-emerald-800' : 'text-emerald-400'
                        } mt-0.5 truncate`}>
                          {badges}
                        </p>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* ITEMIZED SUBJECTS TABLE (CLEAN A4 PORTRAIT MATCHING) */}
                {(() => {
                  const isLight = finalSlipTheme === 'light';
                  const isSimpleMode = selectedFinalSlipData.breakdownMode === 'SIMPLE';
                  const sub = selectedFinalSlipData.subtotalAdj || {};
                  const hasMonthly = !isSimpleMode && (sub.monthlyCount || 0) > 0;
                  const hasFull = !isSimpleMode && (sub.fullCount || 0) > 0;
                  const hasUpgrade = !isSimpleMode && (sub.upgradeCount || 0) > 0;
                  const hasInstallment = !isSimpleMode && ((sub.installmentCount || 0) > 0 || (sub.mixCount || 0) > 0);
                  const hasAdjusted = !isSimpleMode && (sub.adjustedCount || 0) > 0;
                  const hasWht = (sub.whtAmount || 0) > 0;

                  return (
                    <div className={`overflow-hidden rounded-xl border mb-5 relative z-10 ${
                      isLight ? 'border-slate-300' : 'border-white/10'
                    }`}>
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className={`text-[10px] font-extrabold uppercase tracking-wider border-b ${
                          isLight
                            ? 'bg-slate-100 text-slate-800 border-slate-300'
                            : 'bg-black/60 text-slate-300 border-white/10'
                        }`}>
                          <tr>
                            <th className="py-2.5 px-3">
                              {selectedFinalSlipData.isConsolidated ? 'Batch & Subject / Course' : 'Subject / Course'}
                            </th>
                            {hasMonthly && <th className="py-2.5 px-2.5 text-right">Monthly</th>}
                            {hasFull && <th className="py-2.5 px-2.5 text-right">Full</th>}
                            {hasUpgrade && <th className="py-2.5 px-2.5 text-right">Upgrade</th>}
                            {hasInstallment && <th className="py-2.5 px-2.5 text-right">Installment</th>}
                            {hasAdjusted && <th className="py-2.5 px-2.5 text-right">Adjusted</th>}
                            <th className="py-2.5 px-2.5 text-right font-black">Paid Stu</th>
                            <th className={`py-2.5 px-3 text-right font-black ${
                              isLight ? 'text-indigo-950 font-black' : 'text-indigo-300'
                            }`}>Gross (Rs.)</th>
                            {hasWht && <th className="py-2.5 px-2.5 text-right">WHT</th>}
                            <th className={`py-2.5 px-3 text-right font-black ${
                              isLight ? 'text-emerald-700' : 'text-emerald-400'
                            }`}>Net Salary (Rs.)</th>
                          </tr>
                        </thead>
                        <tbody className={`divide-y text-xs font-medium ${
                          isLight ? 'divide-slate-200' : 'divide-white/5'
                        }`}>
                          {selectedFinalSlipData.adjSubjects?.map(({ subject, adj, batchName }, idx) => (
                            <tr
                              key={subject?.id ? `${subject.id}-${idx}` : idx}
                              className={isLight ? 'hover:bg-slate-50' : 'hover:bg-white/[0.02]'}
                            >
                              <td className={`py-2.5 px-3 font-black text-xs ${
                                isLight ? 'text-slate-950 font-black' : 'text-white font-bold'
                              }`}>
                                <div className="flex flex-col">
                                  {(selectedFinalSlipData.isConsolidated || subject?.isManualBatch) && batchName && (
                                    <span className={`text-[9.5px] font-extrabold uppercase tracking-wider mb-0.5 ${
                                      isLight ? 'text-indigo-900 font-black' : 'text-indigo-300 font-bold'
                                    }`}>
                                      Batch: {batchName}
                                    </span>
                                  )}
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-black">
                                      {subject?.name || subject?.subjectName || subject?.normalizedSubName || 'Subject'}
                                    </span>
                                    {subject?.isManualBatch ? (
                                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                        isLight ? 'bg-indigo-100 text-indigo-900 border border-indigo-200' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                      }`}>
                                        Manual Batch
                                      </span>
                                    ) : (subject?.classType === 2 || subject?.isPaperClass) && (
                                      <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded uppercase tracking-wider ${
                                        isLight ? 'bg-purple-100 text-purple-900 border border-purple-200' : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                      }`}>
                                        Paper Class
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </td>
                              {hasMonthly && (
                                <td className={`py-2.5 px-2.5 text-right font-bold ${
                                  isLight ? 'text-blue-700' : 'text-blue-400'
                                }`}>
                                  {adj?.monthlyCount || 0}
                                </td>
                              )}
                              {hasFull && (
                                <td className={`py-2.5 px-2.5 text-right font-bold ${
                                  isLight ? 'text-purple-700' : 'text-purple-300'
                                }`}>
                                  {adj?.fullCount || 0}
                                </td>
                              )}
                              {hasUpgrade && (
                                <td className={`py-2.5 px-2.5 text-right font-semibold ${
                                  isLight ? 'text-rose-700' : 'text-rose-400'
                                }`}>
                                  {adj?.upgradeCount || 0}
                                </td>
                              )}
                              {hasInstallment && (
                                <td className={`py-2.5 px-2.5 text-right font-semibold ${
                                  isLight ? 'text-fuchsia-700' : 'text-fuchsia-400'
                                }`}>
                                  {adj?.installmentCount ?? adj?.mixCount ?? 0}
                                </td>
                              )}
                              {hasAdjusted && (
                                <td className={`py-2.5 px-2.5 text-right font-bold ${
                                  isLight ? 'text-amber-700' : 'text-amber-300'
                                }`}>
                                  {adj?.adjustedCount || 0}
                                </td>
                              )}
                              <td className={`py-2.5 px-2.5 text-right font-black ${
                                isLight ? 'text-emerald-700' : 'text-emerald-400'
                              }`}>
                                {adj?.totalApproved || 0}
                              </td>
                              <td className={`py-2.5 px-3 text-right font-black text-xs ${
                                isLight ? 'text-indigo-950 font-black' : 'text-indigo-300 font-bold'
                              }`}>
                                Rs. {(adj?.grossSalary || 0).toLocaleString()}
                              </td>
                              {hasWht && (
                                <td className={`py-2.5 px-2.5 text-right font-bold ${
                                  isLight ? 'text-amber-700' : 'text-amber-400'
                                }`}>
                                  {(adj?.whtAmount || 0) > 0 ? `-Rs. ${(adj?.whtAmount || 0).toLocaleString()}` : '-'}
                                </td>
                              )}
                              <td className={`py-2.5 px-3 text-right font-black ${
                                isLight ? 'text-emerald-700' : 'text-emerald-400'
                              }`}>
                                Rs. {(adj?.teacherSalary || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className={`font-black text-xs border-t-2 ${
                          isLight
                            ? 'bg-slate-100 text-slate-950 border-slate-300'
                            : 'bg-black/60 text-white border-white/20'
                        }`}>
                          <tr>
                            <td className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-black">
                              Voucher Subtotal
                            </td>
                            {hasMonthly && (
                              <td className={`py-2.5 px-2.5 text-right font-bold ${
                                isLight ? 'text-blue-700' : 'text-blue-400'
                              }`}>
                                {sub.monthlyCount || 0}
                              </td>
                            )}
                            {hasFull && (
                              <td className={`py-2.5 px-2.5 text-right font-bold ${
                                isLight ? 'text-purple-700' : 'text-purple-300'
                              }`}>
                                {sub.fullCount || 0}
                              </td>
                            )}
                            {hasUpgrade && (
                              <td className={`py-2.5 px-2.5 text-right font-semibold ${
                                isLight ? 'text-rose-700' : 'text-rose-400'
                              }`}>
                                {sub.upgradeCount || 0}
                              </td>
                            )}
                            {hasInstallment && (
                              <td className={`py-2.5 px-2.5 text-right font-semibold ${
                                isLight ? 'text-fuchsia-700' : 'text-fuchsia-400'
                              }`}>
                                {sub.installmentCount ?? sub.mixCount ?? 0}
                              </td>
                            )}
                            {hasAdjusted && (
                              <td className={`py-2.5 px-2.5 text-right font-bold ${
                                isLight ? 'text-amber-700' : 'text-amber-400'
                              }`}>
                                {sub.adjustedCount || 0}
                              </td>
                            )}
                            <td className={`py-2.5 px-2.5 text-right font-black ${
                              isLight ? 'text-emerald-700' : 'text-emerald-400'
                            }`}>
                              {sub.totalApproved || 0}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-black text-xs ${
                              isLight ? 'text-indigo-950 font-black' : 'text-indigo-300 font-bold'
                            }`}>
                              Rs. {(sub.grossSalary || 0).toLocaleString()}
                            </td>
                            {hasWht && (
                              <td className={`py-2.5 px-2.5 text-right font-bold ${
                                isLight ? 'text-amber-700' : 'text-amber-400'
                              }`}>
                                {(sub.whtAmount || 0) > 0 ? `-Rs. ${(sub.whtAmount || 0).toLocaleString()}` : '-'}
                              </td>
                            )}
                            <td className={`py-2.5 px-3 text-right font-black text-sm ${
                              isLight ? 'text-emerald-700' : 'text-emerald-400'
                            }`}>
                              Rs. {(sub.teacherSalary || 0).toLocaleString()}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  );
                })()}

                {/* ADDITIONS & DEDUCTIONS BREAKDOWN ON SLIP */}
                {(() => {
                  const isLight = finalSlipTheme === 'light';
                  const hasAdditions = (selectedFinalSlipData.additions || []).length > 0;
                  const hasDeductions = (selectedFinalSlipData.deductions || []).length > 0;
                  if (!hasAdditions && !hasDeductions) return null;

                  const additionsTotal = (selectedFinalSlipData.additions || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  const deductionsTotal = (selectedFinalSlipData.deductions || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5 relative z-10">
                      {/* ADDITIONS BOX */}
                      {hasAdditions ? (
                        <div className={`p-3.5 rounded-xl border ${
                          isLight ? 'bg-emerald-50/70 border-emerald-300' : 'bg-emerald-950/20 border-emerald-500/30'
                        }`}>
                          <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20 mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              isLight ? 'text-emerald-800' : 'text-emerald-300'
                            }`}>
                              (+) Additional Allowances & Payments (එකතු කිරීම්)
                            </span>
                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                              +Rs. {(additionsTotal || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {selectedFinalSlipData.additions.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                  {item.description || 'Addition'}
                                  {Number(item.studentCount) > 0 && (
                                    <span className={`ml-2 text-[10px] font-black px-1.5 py-0.2 rounded border ${
                                      isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    }`}>
                                      {item.studentCount} Students
                                    </span>
                                  )}
                                </span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  +Rs. {(parseFloat(item.amount) || 0).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : <div />}

                      {/* DEDUCTIONS BOX */}
                      {hasDeductions ? (
                        <div className={`p-3.5 rounded-xl border ${
                          isLight ? 'bg-rose-50/70 border-rose-300' : 'bg-rose-950/20 border-rose-500/30'
                        }`}>
                          <div className="flex items-center justify-between pb-2 border-b border-rose-500/20 mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-wider ${
                              isLight ? 'text-rose-800' : 'text-rose-300'
                            }`}>
                              (-) Loan, Advance & Deductions (අඩු කිරීම්)
                            </span>
                            <span className="text-xs font-black text-rose-600 dark:text-rose-400">
                              -Rs. {(deductionsTotal || 0).toLocaleString()}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {selectedFinalSlipData.deductions.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between">
                                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                                  {item.description || 'Deduction'}
                                </span>
                                <span className="font-bold text-rose-600 dark:text-rose-400">
                                  -Rs. {(parseFloat(item.amount) || 0).toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : <div />}
                    </div>
                  );
                })()}

                {/* FINANCIAL SETTLEMENT SUMMARY BOX (NO INSTITUTE RETAINED OR REVENUE LEAKS) */}
                {(() => {
                  const baseSalary = selectedFinalSlipData.subtotalAdj?.teacherSalary || 0;
                  const additionsTotal = (selectedFinalSlipData.additions || []).reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
                  const deductionsTotal = (selectedFinalSlipData.deductions || []).reduce((s, d) => s + (parseFloat(d.amount) || 0), 0);
                  const netPayable = Math.max(0, baseSalary + additionsTotal - deductionsTotal);

                  return (
                    <div className={`p-4 md:p-5 rounded-2xl border relative z-10 ${
                      finalSlipTheme === 'light'
                        ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300'
                        : 'bg-gradient-to-r from-emerald-950/40 via-slate-900 to-emerald-950/40 border-emerald-500/30'
                    } flex flex-wrap items-center justify-between gap-4 mb-6`}>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${finalSlipTheme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                            Gross Lecturer Remuneration:
                          </span>
                          <strong className={`font-black text-base ${
                            finalSlipTheme === 'light' ? 'text-indigo-950 font-black' : 'text-indigo-300'
                          }`}>
                            Rs. {(selectedFinalSlipData.subtotalAdj?.grossSalary || 0).toLocaleString()}
                          </strong>
                        </div>

                        {(selectedFinalSlipData.subtotalAdj?.whtAmount || 0) > 0 && (
                          <div className={`flex items-center gap-2 font-bold ${
                            finalSlipTheme === 'light' ? 'text-amber-700' : 'text-amber-400'
                          }`}>
                            <span>Withholding Tax (WHT Deducted):</span>
                            <span className="font-black">
                              -Rs. {(selectedFinalSlipData.subtotalAdj?.whtAmount || 0).toLocaleString()}
                            </span>
                          </div>
                        )}

                        {additionsTotal > 0 && (
                          <div className={`flex items-center gap-2 font-bold ${
                            finalSlipTheme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                          }`}>
                            <span>Total Additions & Allowances:</span>
                            <span className="font-black">
                              +Rs. {(additionsTotal || 0).toLocaleString()}
                            </span>
                          </div>
                        )}

                        {deductionsTotal > 0 && (
                          <div className={`flex items-center gap-2 font-bold ${
                            finalSlipTheme === 'light' ? 'text-rose-700' : 'text-rose-400'
                          }`}>
                            <span>Total Deductions (Loan / Advance):</span>
                            <span className="font-black">
                              -Rs. {(deductionsTotal || 0).toLocaleString()}
                            </span>
                          </div>
                        )}

                        <p className={`text-[10px] font-medium ${finalSlipTheme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                          Remuneration calculated for {(selectedFinalSlipData.subtotalAdj?.totalApproved || 0)} approved students {selectedFinalSlipData.isConsolidated ? `across ${selectedFinalSlipData.batchesCount} batches` : `(${selectedFinalSlipData.batch?.name})`} • {selectedFinalSlipData.business?.name}.
                        </p>
                      </div>

                      <div className="text-right">
                        <p className={`text-[10px] font-extrabold uppercase tracking-widest ${
                          finalSlipTheme === 'light' ? 'text-emerald-800' : 'text-emerald-400'
                        }`}>
                          Final Net Payable to Lecturer
                        </p>
                        <p className={`text-2xl md:text-3xl font-black tracking-tight mt-0.5 ${
                          finalSlipTheme === 'light' ? 'text-emerald-700' : 'text-emerald-400'
                        }`}>
                          Rs. {(netPayable || 0).toLocaleString()}
                        </p>
                        <p className={`text-[9.5px] font-semibold mt-0.5 ${finalSlipTheme === 'light' ? 'text-slate-600' : 'text-slate-400'}`}>
                          (Full & Final Remuneration Settlement)
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* SIGNATURES BLOCK */}
                <div className={`pt-5 border-t relative z-10 ${
                  finalSlipTheme === 'light' ? 'border-slate-200 text-slate-600' : 'border-white/10 text-slate-400'
                } grid grid-cols-4 gap-3 text-center text-[10.5px]`}>
                  <div className={`border-t border-dashed pt-2 ${finalSlipTheme === 'light' ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Prepared By</p>
                    <p className="text-[9px] opacity-75">Finance & Accounts</p>
                  </div>

                  <div className={`border-t border-dashed pt-2 ${finalSlipTheme === 'light' ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Checked & Verified</p>
                    <p className="text-[9px] opacity-75">Head of Finance</p>
                  </div>

                  <div className={`border-t border-dashed pt-2 ${finalSlipTheme === 'light' ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Authorized By</p>
                    <p className="text-[9px] opacity-75">Director / GM</p>
                  </div>

                  <div className={`border-t border-dashed pt-2 ${finalSlipTheme === 'light' ? 'border-slate-300' : 'border-white/20'}`}>
                    <p className="font-bold">Lecturer Acknowledgement</p>
                    <p className="text-[9px] opacity-75">{selectedFinalSlipData.lecturer?.name}</p>
                  </div>
                </div>

                {/* VOUCHER FOOTER NOTE */}
                <div className={`mt-5 pt-2.5 border-t text-[8.5px] text-center font-medium relative z-10 ${
                  finalSlipTheme === 'light' ? 'border-slate-200 text-slate-400' : 'border-white/5 text-slate-500'
                }`}>
                  IMA Campus ERP • Academic Remuneration & Payroll Subsystem • Official Computer Generated Document
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

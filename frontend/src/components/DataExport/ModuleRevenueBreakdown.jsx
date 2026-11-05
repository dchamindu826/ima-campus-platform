import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from '../../api/axios';
import * as XLSX from 'xlsx';
import { 
    Users, Target, Activity, TrendingUp, DollarSign, Calendar, 
    Filter, Download, Printer, Search, RefreshCw, Sliders, Sparkles,
    CheckCircle2, ArrowUpRight, BarChart2, PieChart, Layers, Tag,
    Briefcase, Award, Zap, ChevronRight, BookOpen, AlertCircle, AlertTriangle,
    ArrowRight, Percent, Check, HelpCircle, LayoutGrid, Table as TableIcon,
    ChevronDown, ChevronUp, Plus, Minus
} from 'lucide-react';

// Greatest Common Divisor helper for precise ratio simplification (e.g. 54:66 -> 9:11)
const getGcd = (a, b) => {
    let x = Math.abs(Math.round(a));
    let y = Math.abs(Math.round(b));
    while (y) {
        const t = y;
        y = x % y;
        x = t;
    }
    return x || 1;
};

const getRatioString = (a, b) => {
    const valA = Math.round(a || 0);
    const valB = Math.round(b || 0);
    if (valA === 0 && valB === 0) return '0 : 0';
    if (valA === 0) return `0 : 1`;
    if (valB === 0) return `1 : 0`;
    const divisor = getGcd(valA, valB);
    return `${Math.round(valA / divisor)} : ${Math.round(valB / divisor)}`;
};

const normalizeStaffKey = (str) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default function ModuleRevenueBreakdown({ filters, businesses = [] }) {
    const reportRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [payments, setPayments] = useState([]);
    const [batches, setBatches] = useState([]);
    
    // CRM Campaign performance stats for Open Seminar and New Inquiries
    const [openSemData, setOpenSemData] = useState(null);
    const [newInqData, setNewInqData] = useState(null);
    const [crmLoading, setCrmLoading] = useState(false);

    // Local filter state initialized with parent props or localStorage or primary business
    const [localFilters, setLocalFilters] = useState(() => {
        const savedBiz = localStorage.getItem('callCamp_selectedBusiness') || localStorage.getItem('afterSem_selectedBusiness');
        const defaultBiz = (filters?.selectedBusiness && filters.selectedBusiness !== 'All') 
            ? filters.selectedBusiness 
            : (savedBiz || (businesses.length > 0 ? businesses[0].id.toString() : 'All'));

        const savedBatch = localStorage.getItem('callCamp_selectedBatch') || localStorage.getItem('afterSem_selectedBatch');
        const defaultBatch = (filters?.selectedBatch && filters.selectedBatch !== 'All')
            ? filters.selectedBatch
            : (savedBatch || 'All');

        return {
            businessId: defaultBiz,
            batchId: defaultBatch,
            type: 'All', // 'All' | 'Full' | 'Monthly' | 'Installment'
            method: 'All', // 'All' | 'Online' | 'Direct' | 'Slip'
            acquisitionSource: 'All', // 'All' | 'OPEN_SEMINAR' | 'NEW_INQ' | 'DIRECT'
            subjectNames: [],
            dateFrom: '',
            dateTo: ''
        };
    });

    // Targets & KPI settings
    const [openSemTarget, setOpenSemTarget] = useState(40); // Target % for Open Seminar
    const [newInqTarget, setNewInqTarget] = useState(40);   // Target % for New Inquiry
    const [defaultBaselineRate, setDefaultBaselineRate] = useState(60); // Default baseline enrolled % (e.g. 60%)

    // Staff Breakdown & What-If Revenue Simulator States
    const [simulationMode, setSimulationMode] = useState(true); // Default active for easy interactive simulation
    const [simulationRates, setSimulationRates] = useState({}); // { [staffName]: simulatedTargetPercent }
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [staffSortBy, setStaffSortBy] = useState('revenue'); // 'revenue' | 'students' | 'share' | 'openSem' | 'newInq' | 'simGain'
    const [staffViewLayout, setStaffViewLayout] = useState('grid'); // 'grid' | 'table'

    // Sync with parent props when they change
    useEffect(() => {
        if (filters?.selectedBusiness) {
            setLocalFilters(prev => ({
                ...prev,
                businessId: filters.selectedBusiness,
                batchId: (filters.selectedBatch && filters.selectedBatch !== '') ? filters.selectedBatch : prev.batchId
            }));
        }
    }, [filters?.selectedBusiness, filters?.selectedBatch]);

    // Fetch batches when business changes (or fallback to first business if 'All')
    useEffect(() => {
        const fetchBatches = async () => {
            const bizIdToFetch = (localFilters.businessId && localFilters.businessId !== 'All') 
                ? localFilters.businessId 
                : (businesses.length > 0 ? businesses[0].id : null);

            if (bizIdToFetch) {
                try {
                    const token = localStorage.getItem('token');
                    const res = await axios.get(`/admin/batches/${bizIdToFetch}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    const batchList = res.data.batches || res.data || [];
                    setBatches(batchList);

                    // If a specific batch has targetIndividualGoal, sync target
                    if (localFilters.batchId !== 'All') {
                        const bObj = batchList.find(b => String(b.id) === String(localFilters.batchId));
                        if (bObj && bObj.targetIndividualGoal) {
                            setOpenSemTarget(parseFloat(bObj.targetIndividualGoal));
                            setNewInqTarget(parseFloat(bObj.targetIndividualGoal));
                        }
                    } else if (batchList.length > 0 && batchList[0].targetIndividualGoal) {
                        setOpenSemTarget(parseFloat(batchList[0].targetIndividualGoal));
                        setNewInqTarget(parseFloat(batchList[0].targetIndividualGoal));
                    }
                } catch (err) {
                    console.error("Error fetching batches:", err);
                }
            } else {
                setBatches([]);
            }
        };
        fetchBatches();
    }, [localFilters.businessId, localFilters.batchId, businesses]);

    // Fetch Open Seminar & New Inquiries lead campaign performance stats
    useEffect(() => {
        const fetchCrmStats = async () => {
            const bizIdToUse = (localFilters.businessId && localFilters.businessId !== 'All') 
                ? localFilters.businessId 
                : (businesses.length > 0 ? businesses[0].id : null);

            if (!bizIdToUse) {
                setOpenSemData(null);
                setNewInqData(null);
                return;
            }

            setCrmLoading(true);
            try {
                const token = localStorage.getItem('token');
                const batchParam = (localFilters.batchId && localFilters.batchId !== 'All') ? localFilters.batchId : 'ALL';
                const [openRes, newInqRes] = await Promise.allSettled([
                    axios.get('/after-seminar-crm/stats/open-seminar', {
                        headers: { Authorization: `Bearer ${token}` },
                        params: {
                            businessId: bizIdToUse,
                            batchId: batchParam
                        }
                    }),
                    axios.get('/after-seminar-crm/stats/new-inquiries', {
                        headers: { Authorization: `Bearer ${token}` },
                        params: {
                            businessId: bizIdToUse,
                            batchId: batchParam
                        }
                    })
                ]);

                if (openRes.status === 'fulfilled' && openRes.value?.data) {
                    setOpenSemData(openRes.value.data);
                    if (openRes.value.data.batchGoals?.targetIndividualGoal) {
                        setOpenSemTarget(parseFloat(openRes.value.data.batchGoals.targetIndividualGoal));
                    }
                }
                if (newInqRes.status === 'fulfilled' && newInqRes.value?.data) {
                    setNewInqData(newInqRes.value.data);
                    if (newInqRes.value.data.batchGoals?.targetIndividualGoal) {
                        setNewInqTarget(parseFloat(newInqRes.value.data.batchGoals.targetIndividualGoal));
                    }
                }
            } catch (err) {
                console.error("Error fetching CRM campaign stats for analytics:", err);
            } finally {
                setCrmLoading(false);
            }
        };

        fetchCrmStats();
    }, [localFilters.businessId, localFilters.batchId, businesses]);

    // Fast O(1) Lookup Maps for Coordinators in CRM Campaigns
    const openSemStaffMap = useMemo(() => {
        const map = {};
        if (openSemData?.staffBreakdown) {
            openSemData.staffBreakdown.forEach(st => {
                if (st.name) map[normalizeStaffKey(st.name)] = st;
                if (st.id) map[st.id] = st;
                if (st.staffId) map[st.staffId] = st;
            });
        }
        return map;
    }, [openSemData]);

    const newInqStaffMap = useMemo(() => {
        const map = {};
        if (newInqData?.staffBreakdown) {
            newInqData.staffBreakdown.forEach(st => {
                if (st.name) map[normalizeStaffKey(st.name)] = st;
                if (st.id) map[st.id] = st;
                if (st.staffId) map[st.staffId] = st;
            });
        }
        return map;
    }, [newInqData]);

    // Fetch payments once on mount
    useEffect(() => {
        const fetchPaymentsData = async () => {
            setLoading(true);
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get('/admin/payments', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const fetchedPays = res.data.payments || res.data || [];
                setPayments(fetchedPays);
            } catch (err) {
                console.error("Error fetching payments for breakdown:", err);
            }
            setLoading(false);
        };
        fetchPaymentsData();
    }, []);

    // Filter payments based on local filter criteria
    const filteredPayments = useMemo(() => {
        return payments.filter(p => {
            // Only approved / active valid payments
            const isApproved = p.status === 'Approved' || p.status === 1 || p.status === 'Post Pay' || p.status === 4 || p.status === 'Discount';
            if (!isApproved) return false;

            const pBizId = (p.businessId || p.business_id)?.toString();
            if (localFilters.businessId !== 'All' && pBizId !== localFilters.businessId.toString()) return false;

            const pBatchId = (p.batchId || p.batch_id)?.toString();
            if (localFilters.batchId !== 'All' && pBatchId !== localFilters.batchId.toString()) return false;

            if (localFilters.type !== 'All') {
                const pType = (p.type || '').toLowerCase();
                const filterType = localFilters.type.toLowerCase();
                if (!pType.includes(filterType)) return false;
            }

            if (localFilters.method !== 'All') {
                const pMethod = (p.method || '').toLowerCase();
                const filterMethod = localFilters.method.toLowerCase();
                if (!pMethod.includes(filterMethod)) return false;
            }

            if (localFilters.acquisitionSource !== 'All') {
                const pSrc = p.inquirySource || 'DIRECT';
                if (pSrc !== localFilters.acquisitionSource) return false;
            }

            if (localFilters.dateFrom) {
                const pDate = new Date(p.date || p.created_at || p.createdAt);
                const fromDate = new Date(`${localFilters.dateFrom}T00:00:00.000Z`);
                if (pDate < fromDate) return false;
            }

            if (localFilters.dateTo) {
                const pDate = new Date(p.date || p.created_at || p.createdAt);
                const toDate = new Date(`${localFilters.dateTo}T23:59:59.999Z`);
                if (pDate > toDate) return false;
            }

            return true;
        });
    }, [payments, localFilters]);

    const getAdjustedAmount = (p) => {
        let amount = parseFloat(p.amount || 0);
        if (p.excessAmount) amount -= parseFloat(p.excessAmount);
        if (p.arrearsAmount) amount += parseFloat(p.arrearsAmount);
        return isNaN(amount) ? 0 : amount;
    };

    // Calculate aggregated statistics
    const stats = useMemo(() => {
        let totalRev = 0;
        let fullRev = 0, monthlyRev = 0, installRev = 0;
        const uniqueStudents = new Set();

        let openSemRev = 0, openSemSlips = 0;
        const openSemStudents = new Set();
        let newInqRev = 0, newInqSlips = 0;
        const newInqStudents = new Set();
        let directRev = 0, directSlips = 0;
        const directStudents = new Set();

        const staffStatsMap = {};
        const subjectStatsMap = {};

        filteredPayments.forEach(p => {
            const amt = getAdjustedAmount(p);
            totalRev += amt;
            uniqueStudents.add(p.studentId);

            const src = p.inquirySource || 'DIRECT';
            if (src === 'OPEN_SEMINAR') {
                openSemRev += amt;
                openSemSlips++;
                openSemStudents.add(p.studentId);
            } else if (src === 'NEW_INQ') {
                newInqRev += amt;
                newInqSlips++;
                newInqStudents.add(p.studentId);
            } else {
                directRev += amt;
                directSlips++;
                directStudents.add(p.studentId);
            }

            const pType = (p.type || '').toLowerCase();
            if (pType.includes('full')) fullRev += amt;
            else if (pType.includes('install')) installRev += amt;
            else monthlyRev += amt;

            // Track staff
            const staffName = (p.assignedStaffName && p.assignedStaffName.trim() !== '') 
                ? p.assignedStaffName.trim() 
                : (src === 'DIRECT' ? 'Direct / Untracked' : 'Unassigned / Direct');
            const staffId = p.assignedStaffId || 'unassigned';

            if (!staffStatsMap[staffName]) {
                staffStatsMap[staffName] = {
                    id: staffId,
                    name: staffName,
                    totalRevenue: 0,
                    slips: 0,
                    students: new Set(),
                    fullRev: 0,
                    monthlyRev: 0,
                    installRev: 0,
                    studentPlans: {}, // studentId -> 'full' | 'installment' | 'monthly'
                    openSemRev: 0,
                    openSemSlips: 0,
                    openSemStudents: new Set(),
                    newInqRev: 0,
                    newInqSlips: 0,
                    newInqStudents: new Set(),
                    directRev: 0,
                    directSlips: 0,
                    directStudents: new Set()
                };
            }

            const st = staffStatsMap[staffName];
            st.totalRevenue += amt;
            st.slips++;
            st.students.add(p.studentId);

            if (pType.includes('full')) {
                st.fullRev += amt;
                st.studentPlans[p.studentId] = 'full';
            } else if (pType.includes('install')) {
                st.installRev += amt;
                if (st.studentPlans[p.studentId] !== 'full') {
                    st.studentPlans[p.studentId] = 'installment';
                }
            } else {
                st.monthlyRev += amt;
                if (!st.studentPlans[p.studentId]) {
                    st.studentPlans[p.studentId] = 'monthly';
                }
            }

            if (src === 'OPEN_SEMINAR') {
                st.openSemRev += amt;
                st.openSemSlips++;
                st.openSemStudents.add(p.studentId);
            } else if (src === 'NEW_INQ') {
                st.newInqRev += amt;
                st.newInqSlips++;
                st.newInqStudents.add(p.studentId);
            } else {
                st.directRev += amt;
                st.directSlips++;
                st.directStudents.add(p.studentId);
            }

            // Track subjects
            const subs = p.subjectsList || p.subjects || p.courses || [];
            subs.forEach(s => {
                const sName = s.name || s.courseName;
                if (sName) {
                    const cleanName = sName.replace(/\s*-\s*(Full|Monthly|Installment)/i, '').trim();
                    if (!subjectStatsMap[cleanName]) {
                        subjectStatsMap[cleanName] = { name: cleanName, revenue: 0, students: new Set(), slips: 0 };
                    }
                    subjectStatsMap[cleanName].revenue += amt;
                    subjectStatsMap[cleanName].students.add(p.studentId);
                    subjectStatsMap[cleanName].slips++;
                }
            });
        });

        // Ensure coordinators from CRM campaign stats are present in the map even if 0 payments yet
        const ensureCrmStaff = (crmList) => {
            if (!crmList) return;
            crmList.forEach(st => {
                const sName = (st.name || '').trim();
                if (sName && !staffStatsMap[sName]) {
                    staffStatsMap[sName] = {
                        id: st.staffId || st.id || 'unassigned',
                        name: sName,
                        totalRevenue: 0,
                        slips: 0,
                        students: new Set(),
                        fullRev: 0,
                        monthlyRev: 0,
                        installRev: 0,
                        studentPlans: {},
                        openSemRev: 0,
                        openSemSlips: 0,
                        openSemStudents: new Set(),
                        newInqRev: 0,
                        newInqSlips: 0,
                        newInqStudents: new Set(),
                        directRev: 0,
                        directSlips: 0,
                        directStudents: new Set()
                    };
                }
            });
        };
        ensureCrmStaff(openSemData?.staffBreakdown);
        ensureCrmStaff(newInqData?.staffBreakdown);

        // Format staff list with true campaign leads, achievements, and ratios
        const totalUniqueStudentsCount = uniqueStudents.size || 1;
        const formattedStaffStats = Object.values(staffStatsMap).map(s => {
            const studentCount = s.students.size;
            const revenueShare = totalRev > 0 ? (s.totalRevenue / totalRev) * 100 : 0;
            const studentShare = (studentCount / totalUniqueStudentsCount) * 100;
            const avgRevPerStudent = studentCount > 0 ? s.totalRevenue / studentCount : 0;

            // Mutually exclusive plan distribution summing strictly to 100% of studentCount
            let monthlyCount = 0;
            let fullCount = 0;
            let installCount = 0;
            Object.values(s.studentPlans || {}).forEach(plan => {
                if (plan === 'full') fullCount++;
                else if (plan === 'installment') installCount++;
                else monthlyCount++;
            });

            // Fallback: if student wasn't registered in studentPlans, assign to monthly
            const accountedCount = monthlyCount + fullCount + installCount;
            if (accountedCount < studentCount) {
                monthlyCount += (studentCount - accountedCount);
            }

            const monthlyPct = studentCount > 0 ? Number(((monthlyCount / studentCount) * 100).toFixed(1)) : 0;
            const fullPct = studentCount > 0 ? Number(((fullCount / studentCount) * 100).toFixed(1)) : 0;
            const installPct = studentCount > 0 ? Number(((installCount / studentCount) * 100).toFixed(1)) : 0;
            const monthlyFullRatio = getRatioString(monthlyCount, fullCount);

            // 🎯 1. OPEN SEMINAR CAMPAIGN DATA LINKING 🎯
            const staffKey = normalizeStaffKey(s.name);
            const openSemCrm = openSemStaffMap[staffKey] || (s.id ? openSemStaffMap[s.id] : null);
            
            // Assigned leads from Open Seminar CRM
            const openSemAssigned = openSemCrm?.overall?.assigned || 0;
            // Paid count for Open Seminar
            const openSemPaidCount = (openSemCrm?.overall?.enrolled !== undefined && openSemCrm?.overall?.enrolled > 0)
                ? openSemCrm.overall.enrolled
                : s.openSemStudents.size;
            
            // Exact Campaign Conversion Rate: (Paid / Assigned) * 100
            const openSemConversionRate = openSemAssigned > 0 
                ? Number(((openSemPaidCount / openSemAssigned) * 100).toFixed(1)) 
                : 0;
            
            // Target Goal Achievement % vs Target (e.g. 40%)
            const openSemAchieved = openSemTarget > 0 
                ? Number(((openSemConversionRate / openSemTarget) * 100).toFixed(1)) 
                : 0;
            const openSemIsMet = openSemConversionRate >= openSemTarget;

            // ⚡ 2. NEW INQUIRIES CAMPAIGN DATA LINKING ⚡
            const newInqCrm = newInqStaffMap[staffKey] || (s.id ? newInqStaffMap[s.id] : null);
            
            // Assigned leads from New Inquiries CRM
            const newInqAssigned = newInqCrm?.overall?.assigned || 0;
            // Paid count for New Inquiries
            const newInqPaidCount = (newInqCrm?.overall?.enrolled !== undefined && newInqCrm?.overall?.enrolled > 0)
                ? newInqCrm.overall.enrolled
                : s.newInqStudents.size;
            
            // Exact Campaign Conversion Rate: (Paid / Assigned) * 100
            const newInqConversionRate = newInqAssigned > 0 
                ? Number(((newInqPaidCount / newInqAssigned) * 100).toFixed(1)) 
                : 0;
            
            // Target Goal Achievement % vs Target (e.g. 40%)
            const newInqAchieved = newInqTarget > 0 
                ? Number(((newInqConversionRate / newInqTarget) * 100).toFixed(1)) 
                : 0;
            const newInqIsMet = newInqConversionRate >= newInqTarget;

            // Direct / Other
            const directCount = s.directStudents.size;
            const directShare = studentCount > 0 ? Number(((directCount / studentCount) * 100).toFixed(1)) : 0;

            // 🌟 COORDINATOR OVERALL ENROLLED CONVERSION RATE & LEADS POOL 🌟
            const totalAssignedLeads = openSemAssigned + newInqAssigned;
            const overallConversionRate = totalAssignedLeads > 0 
                ? Number(((studentCount / totalAssignedLeads) * 100).toFixed(1)) 
                : defaultBaselineRate;
            const poolLeads = totalAssignedLeads > 0 
                ? totalAssignedLeads 
                : (studentCount > 0 ? Math.round(studentCount / (defaultBaselineRate / 100)) : 0);

            return {
                id: s.id,
                name: s.name,
                totalRevenue: s.totalRevenue,
                slips: s.slips,
                studentCount,
                revenueShare: Number(revenueShare.toFixed(1)),
                studentShare: Number(studentShare.toFixed(1)),
                avgRevPerStudent: Math.round(avgRevPerStudent),
                
                // Plans
                fullRev: s.fullRev,
                fullCount,
                fullPct,
                monthlyRev: s.monthlyRev,
                monthlyCount,
                monthlyPct,
                installRev: s.installRev,
                installCount,
                installPct,
                monthlyFullRatio,

                // 🎯 Open Seminar Breakdown
                openSemRev: s.openSemRev,
                openSemCount: openSemPaidCount,
                openSemAssigned,
                openSemConversionRate,
                openSemAchieved,
                openSemIsMet,

                // ⚡ New Inquiries Breakdown
                newInqRev: s.newInqRev,
                newInqCount: newInqPaidCount,
                newInqAssigned,
                newInqConversionRate,
                newInqAchieved,
                newInqIsMet,

                // Direct
                directRev: s.directRev,
                directCount,
                directShare,

                // Overall baseline metrics
                totalAssignedLeads,
                overallConversionRate,
                poolLeads
            };
        });

        return {
            totalRevenue: totalRev,
            studentCount: uniqueStudents.size,
            slipsCount: filteredPayments.length,
            averageTicket: uniqueStudents.size > 0 ? Math.round(totalRev / uniqueStudents.size) : 0,
            fullRev,
            monthlyRev,
            installRev,
            acquisition: {
                openSeminar: {
                    revenue: openSemRev,
                    slips: openSemSlips,
                    students: openSemStudents.size,
                    share: totalRev > 0 ? Number(((openSemRev / totalRev) * 100).toFixed(1)) : 0
                },
                newInquiry: {
                    revenue: newInqRev,
                    slips: newInqSlips,
                    students: newInqStudents.size,
                    share: totalRev > 0 ? Number(((newInqRev / totalRev) * 100).toFixed(1)) : 0
                },
                direct: {
                    revenue: directRev,
                    slips: directSlips,
                    students: directStudents.size,
                    share: totalRev > 0 ? Number(((directRev / totalRev) * 100).toFixed(1)) : 0
                }
            },
            staffStats: formattedStaffStats,
            subjectStats: Object.values(subjectStatsMap).map(sub => ({
                name: sub.name,
                revenue: sub.revenue,
                studentsCount: sub.students.size,
                slips: sub.slips
            })).sort((a, b) => b.revenue - a.revenue)
        };
    }, [filteredPayments, openSemTarget, newInqTarget, openSemStaffMap, newInqStaffMap, defaultBaselineRate]);

    // Handle What-If simulation rate change (manual typed or slider)
    const handleSimulationRateChange = (staffName, newRate) => {
        if (newRate === '' || newRate === null || newRate === undefined) {
            setSimulationRates(prev => ({
                ...prev,
                [staffName]: ''
            }));
            return;
        }
        const parsed = Math.max(1, Math.min(100, Math.round(parseFloat(newRate) || 0)));
        setSimulationRates(prev => ({
            ...prev,
            [staffName]: parsed
        }));
    };

    const handleSimulationRateBlur = (staffName, baseRate) => {
        setSimulationRates(prev => {
            const current = prev[staffName];
            if (current === '' || current === undefined || isNaN(current)) {
                return { ...prev, [staffName]: baseRate };
            }
            return prev;
        });
    };

    // Quick boost helper (+5%, +10%, etc.)
    const handleQuickBoost = (staffName, currentSimRate, delta) => {
        const parsed = (currentSimRate !== '' && currentSimRate !== undefined) ? currentSimRate : defaultBaselineRate;
        const next = Math.max(1, Math.min(100, parsed + delta));
        handleSimulationRateChange(staffName, next);
    };

    // Fine-grained stepper (+1%, -1%)
    const handleStepRate = (staffName, currentSimRate, delta) => {
        const parsed = (currentSimRate !== '' && currentSimRate !== undefined) ? currentSimRate : defaultBaselineRate;
        const next = Math.max(1, Math.min(100, Math.round(parsed + delta)));
        handleSimulationRateChange(staffName, next);
    };

    const resetSimulation = () => {
        setSimulationRates({});
    };

    const applyGlobalBoost = (boostDelta) => {
        const updated = {};
        (stats.staffStats || []).forEach(s => {
            const base = s.overallConversionRate || defaultBaselineRate;
            const current = (simulationRates[s.name] !== undefined && simulationRates[s.name] !== '') ? simulationRates[s.name] : base;
            updated[s.name] = Math.max(1, Math.min(100, Math.round(current + boostDelta)));
        });
        setSimulationRates(updated);
    };

    // 🔥 MATHEMATICALLY ACCURATE SIMULATION ENGINE (NO ROUNDING ARTIFACTS) 🔥
    const simulatedStaffData = useMemo(() => {
        return (stats.staffStats || []).map(staff => {
            const baseRate = staff.overallConversionRate || defaultBaselineRate;
            const rawSimRate = simulationRates[staff.name] !== undefined ? simulationRates[staff.name] : baseRate;
            const simRate = (rawSimRate !== '' && rawSimRate !== undefined && !isNaN(rawSimRate)) 
                ? Number(rawSimRate) 
                : baseRate;
            const isSimulated = simRate !== baseRate;
            const deltaRate = Number((simRate - baseRate).toFixed(1));
            const poolLeads = staff.poolLeads;

            let simStudents = staff.studentCount;
            let deltaStudents = 0;
            let simMonthly = staff.monthlyCount;
            let simFull = staff.fullCount;
            let simInstall = staff.installCount;
            let simRevenue = staff.totalRevenue;
            let deltaRevenue = 0;
            let gainPercentage = 0;

            if (isSimulated) {
                simStudents = poolLeads > 0 
                    ? Math.round(poolLeads * (simRate / 100)) 
                    : (baseRate > 0 ? Math.round(staff.studentCount * (simRate / baseRate)) : staff.studentCount);
                deltaStudents = simStudents - staff.studentCount;

                if (staff.studentCount > 0) {
                    if (staff.installCount === 0) {
                        simMonthly = Math.round(simStudents * (staff.monthlyCount / staff.studentCount));
                        simFull = Math.max(0, simStudents - simMonthly);
                        simInstall = 0;
                    } else {
                        simMonthly = Math.round(simStudents * (staff.monthlyCount / staff.studentCount));
                        simFull = Math.round(simStudents * (staff.fullCount / staff.studentCount));
                        simInstall = Math.max(0, simStudents - simMonthly - simFull);
                    }
                }

                const avgMonthlyTicket = staff.monthlyCount > 0 ? (staff.monthlyRev / staff.monthlyCount) : (staff.avgRevPerStudent * 0.7);
                const avgFullTicket = staff.fullCount > 0 ? (staff.fullRev / staff.fullCount) : (staff.avgRevPerStudent * 1.5);
                const avgInstallTicket = staff.installCount > 0 ? (staff.installRev / staff.installCount) : staff.avgRevPerStudent;

                const simMonthlyRev = Math.round(simMonthly * avgMonthlyTicket);
                const simFullRev = Math.round(simFull * avgFullTicket);
                const simInstallRev = Math.round(simInstall * avgInstallTicket);
                simRevenue = simMonthlyRev + simFullRev + simInstallRev;

                if (simRevenue === 0 && staff.totalRevenue > 0) {
                    simRevenue = Math.round(staff.totalRevenue * (simStudents / (staff.studentCount || 1)));
                }

                deltaRevenue = simRevenue - staff.totalRevenue;
                gainPercentage = staff.totalRevenue > 0 ? Number(((deltaRevenue / staff.totalRevenue) * 100).toFixed(1)) : 0;
            }

            const deltaMonthly = simMonthly - staff.monthlyCount;
            const deltaFull = simFull - staff.fullCount;
            const deltaInstall = simInstall - staff.installCount;

            return {
                ...staff,
                baseRate,
                simRate,
                rawSimRate,
                isSimulated,
                deltaRate,
                simStudents,
                deltaStudents,
                simMonthly,
                deltaMonthly,
                simFull,
                deltaFull,
                simInstall,
                deltaInstall,
                simRevenue,
                deltaRevenue,
                gainPercentage
            };
        });
    }, [stats.staffStats, simulationRates, defaultBaselineRate]);

    const simulatedTotals = useMemo(() => {
        let totalGain = 0;
        let totalStudentGain = 0;
        simulatedStaffData.forEach(s => {
            totalGain += (s.deltaRevenue || 0);
            totalStudentGain += (s.deltaStudents || 0);
        });
        const projectedRevenue = stats.totalRevenue + totalGain;
        const projectedStudents = stats.studentCount + totalStudentGain;
        const percentageGain = stats.totalRevenue > 0 ? ((totalGain / stats.totalRevenue) * 100).toFixed(1) : 0;
        return {
            totalGain,
            totalStudentGain,
            projectedRevenue,
            projectedStudents,
            percentageGain
        };
    }, [simulatedStaffData, stats.totalRevenue, stats.studentCount]);

    // Filter & Sort Staff Data for Display
    const displayedStaffData = useMemo(() => {
        let list = [...simulatedStaffData];

        if (staffSearchQuery.trim()) {
            const q = staffSearchQuery.toLowerCase();
            list = list.filter(s => s.name.toLowerCase().includes(q));
        }

        list.sort((a, b) => {
            if (staffSortBy === 'revenue') return b.totalRevenue - a.totalRevenue;
            if (staffSortBy === 'students') return b.studentCount - a.studentCount;
            if (staffSortBy === 'share') return b.revenueShare - a.revenueShare;
            if (staffSortBy === 'openSem') return b.openSemConversionRate - a.openSemConversionRate;
            if (staffSortBy === 'newInq') return b.newInqConversionRate - a.newInqConversionRate;
            if (staffSortBy === 'simGain') return (b.deltaRevenue || 0) - (a.deltaRevenue || 0);
            return 0;
        });

        return list;
    }, [simulatedStaffData, staffSearchQuery, staffSortBy]);

    // Export to Excel / CSV with exact campaign metrics & ratios
    const handleExportExcel = () => {
        const rows = displayedStaffData.map(s => ({
            'Coordinator Name': s.name,
            'Total Enrolled Students': s.studentCount,
            'Total Revenue (LKR)': s.totalRevenue,
            'Campus Revenue Share (%)': `${s.revenueShare}%`,
            'Avg Per Student (LKR)': s.avgRevPerStudent,
            
            // Channel Open Seminar
            'Open Seminar Assigned Leads': s.openSemAssigned,
            'Open Seminar Paid Students': s.openSemCount,
            'Open Seminar Conversion Rate (%)': `${s.openSemConversionRate}%`,
            'Open Seminar Target Benchmark (%)': `${openSemTarget}%`,
            'Open Seminar Target Achieved (%)': `${s.openSemAchieved}%`,
            'Open Seminar Revenue (LKR)': s.openSemRev,

            // Channel New Inquiries
            'New Inquiry Assigned Leads': s.newInqAssigned,
            'New Inquiry Paid Students': s.newInqCount,
            'New Inquiry Conversion Rate (%)': `${s.newInqConversionRate}%`,
            'New Inquiry Target Benchmark (%)': `${newInqTarget}%`,
            'New Inquiry Target Achieved (%)': `${s.newInqAchieved}%`,
            'New Inquiry Revenue (LKR)': s.newInqRev,

            // Plan Split & Ratio
            'Monthly Count': s.monthlyCount,
            'Monthly Rev (LKR)': s.monthlyRev,
            'Monthly Share (%)': `${s.monthlyPct}%`,
            'Full Payment Count': s.fullCount,
            'Full Payment Rev (LKR)': s.fullRev,
            'Full Payment Share (%)': `${s.fullPct}%`,
            'Monthly to Full Ratio': s.monthlyFullRatio,
            'Installment Count': s.installCount,
            'Installment Rev (LKR)': s.installRev,

            // Simulation Metrics
            'Base Conversion (%)': `${s.baseRate}%`,
            'Simulated Conversion (%)': `${s.simRate}%`,
            'Simulated Students': s.simStudents,
            'Simulated Gain Students': s.deltaStudents,
            'Projected Total Revenue (LKR)': s.simRevenue,
            'Projected Net Gain (LKR)': s.deltaRevenue,
            'Projected Gain (%)': `${s.gainPercentage}%`
        }));

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Coordinator Performance Matrix");
        XLSX.writeFile(wb, `Coordinator_Performance_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="w-14 h-14 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <span className="text-slate-300 font-extrabold uppercase tracking-widest text-sm">Loading Data Analytics & Revenue Matrix...</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-8 animate-fade-in pb-20 text-slate-100" ref={reportRef}>
            
            {/* 🌟 1. EXECUTIVE SCOPE & BATCH SWITCHER BAR 🌟 */}
            <div className="bg-[#111827]/95 backdrop-blur-2xl p-6 rounded-3xl border border-slate-700/80 shadow-2xl flex flex-col gap-5">
                
                {/* Upper Row: Business & Batch Dropdowns + Export Actions */}
                <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-5">
                    
                    {/* Left: Active Scope & Dropdowns */}
                    <div className="flex items-center gap-4 flex-wrap">
                        
                        {/* Business Dropdown */}
                        <div className="flex items-center gap-3 bg-black/60 px-4 py-3 rounded-2xl border border-emerald-500/30 shadow-inner">
                            <Briefcase size={20} className="text-emerald-400 shrink-0" />
                            <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Business Campaign</span>
                                <select 
                                    value={localFilters.businessId}
                                    onChange={(e) => setLocalFilters(prev => ({ ...prev, businessId: e.target.value, batchId: 'All' }))}
                                    className="bg-transparent text-sm sm:text-base font-black text-emerald-300 outline-none cursor-pointer hover:text-emerald-200 transition-colors"
                                >
                                    <option value="All" className="bg-slate-900 text-white font-semibold">All Businesses</option>
                                    {businesses.map(b => (
                                        <option key={b.id} value={b.id} className="bg-slate-900 text-white font-semibold">{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Batch Dropdown */}
                        {batches.length > 0 && (
                            <div className="flex items-center gap-3 bg-black/60 px-4 py-3 rounded-2xl border border-cyan-500/30 shadow-inner">
                                <Layers size={20} className="text-cyan-400 shrink-0" />
                                <div className="flex flex-col">
                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Class Batch</span>
                                    <select 
                                        value={localFilters.batchId}
                                        onChange={(e) => setLocalFilters(prev => ({ ...prev, batchId: e.target.value }))}
                                        className="bg-transparent text-sm sm:text-base font-black text-cyan-300 outline-none cursor-pointer hover:text-cyan-200 transition-colors"
                                    >
                                        <option value="All" className="bg-slate-900 text-white font-semibold">All Batches (Combined)</option>
                                        {batches.map(b => (
                                            <option key={b.id} value={b.id} className="bg-slate-900 text-white font-semibold">{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        {/* Benchmark Target Goals Inputs */}
                        <div className="flex items-center gap-3 bg-black/70 px-4 py-2.5 rounded-2xl border border-amber-500/40 shadow-inner flex-wrap">
                            <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                                <Target size={16} className="text-amber-400" /> Target Goals:
                            </span>
                            
                            {/* Open Seminar Target Input */}
                            <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/40 px-3 py-1.5 rounded-xl">
                                <span className="text-xs font-black text-amber-300 uppercase">Open Sem:</span>
                                <input 
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={openSemTarget}
                                    onChange={(e) => setOpenSemTarget(Math.max(1, Math.min(100, parseInt(e.target.value) || 40)))}
                                    className="w-14 bg-transparent text-center font-black text-amber-300 text-base outline-none border-b-2 border-amber-400/80"
                                    title="Edit Open Seminar Target Goal %"
                                />
                                <span className="text-sm font-black text-amber-400">%</span>
                            </div>

                            {/* New Inquiries Target Input */}
                            <div className="flex items-center gap-1.5 bg-fuchsia-500/20 border border-fuchsia-500/40 px-3 py-1.5 rounded-xl">
                                <span className="text-xs font-black text-fuchsia-300 uppercase">New Inq:</span>
                                <input 
                                    type="number"
                                    min="1"
                                    max="100"
                                    value={newInqTarget}
                                    onChange={(e) => setNewInqTarget(Math.max(1, Math.min(100, parseInt(e.target.value) || 40)))}
                                    className="w-14 bg-transparent text-center font-black text-fuchsia-300 text-base outline-none border-b-2 border-fuchsia-400/80"
                                    title="Edit New Inquiry Target Goal %"
                                />
                                <span className="text-sm font-black text-fuchsia-400">%</span>
                            </div>
                        </div>

                    </div>

                    {/* Right: Actions, Simulator Toggle & Export */}
                    <div className="flex items-center gap-3 flex-wrap">
                        
                        {/* What-If Simulator Toggle */}
                        <button 
                            onClick={() => setSimulationMode(!simulationMode)}
                            className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 transition-all shadow-xl ${
                                simulationMode 
                                    ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 text-white ring-2 ring-amber-400/60 shadow-amber-500/40' 
                                    : 'bg-slate-800/90 hover:bg-slate-700 text-amber-400 border border-amber-400/40 hover:border-amber-400/70'
                            }`}
                            title="Toggle Interactive Target & Conversion What-If Simulator"
                        >
                            <Sparkles size={18} className={simulationMode ? 'animate-spin' : ''} />
                            <span>{simulationMode ? 'Simulator Active ⚡' : 'What-If Simulator 🎯'}</span>
                        </button>

                        {/* Export to Excel */}
                        <button 
                            onClick={handleExportExcel}
                            className="px-5 py-3 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-lg hover:shadow-emerald-500/20"
                            title="Download detailed Excel spreadsheet with exact campaign targets & ratios"
                        >
                            <Download size={16} />
                            <span>Export Excel</span>
                        </button>

                        {/* Print Report */}
                        <button 
                            onClick={() => window.print()}
                            className="px-4 py-3 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-2xl text-xs sm:text-sm font-bold uppercase transition-all"
                            title="Print report"
                        >
                            <Printer size={18} />
                        </button>
                    </div>

                </div>

                {/* Lower Row: Quick Batch Selector Pills (1-Click Switch) */}
                {batches.length > 0 && (
                    <div className="flex items-center gap-2 pt-4 border-t border-slate-700/60 overflow-x-auto custom-scrollbar pb-1">
                        <span className="text-xs font-black uppercase text-slate-400 tracking-wider mr-1 shrink-0 flex items-center gap-1.5">
                            <Tag size={13} className="text-cyan-400" /> Select Batch:
                        </span>
                        
                        <button
                            onClick={() => setLocalFilters(prev => ({ ...prev, batchId: 'All' }))}
                            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all border ${
                                localFilters.batchId === 'All'
                                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.4)]'
                                    : 'bg-black/40 text-slate-300 border-white/10 hover:border-cyan-400/50 hover:text-white'
                            }`}
                        >
                            All Batches
                        </button>

                        {batches.map(b => {
                            const isSelected = String(localFilters.batchId) === String(b.id);
                            return (
                                <button
                                    key={b.id}
                                    onClick={() => setLocalFilters(prev => ({ ...prev, batchId: String(b.id) }))}
                                    className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all border ${
                                        isSelected
                                            ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-cyan-300 shadow-[0_0_20px_rgba(99,102,241,0.5)]'
                                            : 'bg-black/40 text-slate-300 border-white/10 hover:border-indigo-400/50 hover:text-white'
                                    }`}
                                >
                                    {b.name}
                                </button>
                            );
                        })}
                    </div>
                )}

            </div>

            {/* 📊 2. HIGH-IMPACT BATCH TOTAL REVENUE METRICS 📊 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                
                {/* Total Revenue */}
                <div className="bg-gradient-to-br from-emerald-950/60 via-slate-900/90 to-slate-900 p-6 rounded-3xl border-2 border-emerald-500/40 shadow-xl relative overflow-hidden group hover:border-emerald-500/60 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                        <DollarSign size={80} className="text-emerald-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <DollarSign size={16} /> Total Batch Revenue
                    </span>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        Rs. {stats.totalRevenue.toLocaleString()}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-semibold mt-2">
                        Across <strong className="text-white font-bold">{stats.slipsCount} transactions</strong> • Rs. {stats.averageTicket.toLocaleString()} / student
                    </p>
                </div>

                {/* Total Paid Students */}
                <div className="bg-gradient-to-br from-cyan-950/60 via-slate-900/90 to-slate-900 p-6 rounded-3xl border-2 border-cyan-500/40 shadow-xl relative overflow-hidden group hover:border-cyan-500/60 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                        <Users size={80} className="text-cyan-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-black text-cyan-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                        <Users size={16} /> Enrolled Students
                    </span>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        {stats.studentCount.toLocaleString()} Students
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-semibold mt-2">
                        Full Pay: <strong className="text-purple-300 font-bold">{stats.staffStats.reduce((acc, s) => acc + s.fullCount, 0)}</strong> • Monthly: <strong className="text-cyan-300 font-bold">{stats.staffStats.reduce((acc, s) => acc + s.monthlyCount, 0)}</strong>
                    </p>
                </div>

                {/* Open Seminar Channel */}
                <div className="bg-gradient-to-br from-amber-950/60 via-slate-900/90 to-slate-900 p-6 rounded-3xl border-2 border-amber-500/40 shadow-xl relative overflow-hidden group hover:border-amber-500/60 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                        <Target size={80} className="text-amber-400" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs sm:text-sm font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                            <Target size={16} /> Open Seminar Channel
                        </span>
                        <span className="text-xs font-black bg-amber-500/25 text-amber-300 border border-amber-500/50 px-2.5 py-0.5 rounded-lg">
                            Target: {openSemTarget}%
                        </span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        Rs. {stats.acquisition.openSeminar.revenue.toLocaleString()}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-semibold mt-2">
                        <strong className="text-amber-300 font-black">{stats.acquisition.openSeminar.students} paid</strong>
                        {openSemData?.totalAssigned ? ` (out of ${openSemData.totalAssigned} leads • ${Math.round((stats.acquisition.openSeminar.students / openSemData.totalAssigned) * 100)}% Conv)` : ` (${stats.acquisition.openSeminar.share}% rev share)`}
                    </p>
                </div>

                {/* New Inquiry Channel */}
                <div className="bg-gradient-to-br from-fuchsia-950/60 via-slate-900/90 to-slate-900 p-6 rounded-3xl border-2 border-fuchsia-500/40 shadow-xl relative overflow-hidden group hover:border-fuchsia-500/60 transition-all">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-25 transition-opacity">
                        <Zap size={80} className="text-fuchsia-400" />
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs sm:text-sm font-black text-fuchsia-400 uppercase tracking-widest flex items-center gap-2">
                            <Zap size={16} /> New Inquiries Channel
                        </span>
                        <span className="text-xs font-black bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/50 px-2.5 py-0.5 rounded-lg">
                            Target: {newInqTarget}%
                        </span>
                    </div>
                    <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                        Rs. {stats.acquisition.newInquiry.revenue.toLocaleString()}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-300 font-semibold mt-2">
                        <strong className="text-fuchsia-300 font-black">{stats.acquisition.newInquiry.students} paid</strong>
                        {newInqData?.totalAssigned ? ` (out of ${newInqData.totalAssigned} leads • ${Math.round((stats.acquisition.newInquiry.students / newInqData.totalAssigned) * 100)}% Conv)` : ` (${stats.acquisition.newInquiry.share}% rev share)`}
                    </p>
                </div>

            </div>

            {/* 🔥 3. WHAT-IF REVENUE SIMULATOR BANNER 🔥 */}
            {simulationMode && (
                <div className="bg-gradient-to-r from-amber-500/20 via-purple-600/20 to-emerald-500/20 border-2 border-amber-400/60 rounded-3xl p-7 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.25)] animate-fade-in relative overflow-hidden">
                    <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
                        
                        <div className="max-w-2xl">
                            <div className="flex items-center gap-3 text-amber-400 font-black text-lg sm:text-xl uppercase tracking-wider mb-2">
                                <Sparkles size={26} className="text-amber-400 animate-spin" />
                                <span>Interactive Target & Conversion What-If Simulator</span>
                            </div>
                            <p className="text-sm sm:text-base text-slate-200 font-semibold leading-relaxed">
                                Adjust each coordinator's target conversion % below. Enrolled student count and revenue scale proportionately, strictly maintaining each coordinator's exact <strong className="text-cyan-300">Monthly : Full Pay ratio</strong>.
                            </p>
                            
                            {/* Fast Global Presets */}
                            <div className="flex items-center gap-3 mt-4 flex-wrap">
                                <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-400">Quick Global Boost:</span>
                                <button 
                                    onClick={() => applyGlobalBoost(5)}
                                    className="px-4 py-2 bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md"
                                >
                                    +5% to All
                                </button>
                                <button 
                                    onClick={() => applyGlobalBoost(10)}
                                    className="px-4 py-2 bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md"
                                >
                                    +10% to All
                                </button>
                                <button 
                                    onClick={() => applyGlobalBoost(15)}
                                    className="px-4 py-2 bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 rounded-xl text-xs sm:text-sm font-black transition-all shadow-md"
                                >
                                    +15% to All
                                </button>
                                <button 
                                    onClick={resetSimulation}
                                    className="px-4 py-2 bg-rose-500/25 hover:bg-rose-500/40 text-rose-300 border border-rose-500/50 rounded-xl text-xs sm:text-sm font-black transition-all ml-1 shadow-md"
                                >
                                    Reset All
                                </button>
                            </div>
                        </div>

                        {/* Projection Summary Card */}
                        <div className="flex items-center gap-8 bg-black/80 p-6 rounded-3xl border border-amber-500/50 shadow-2xl flex-wrap">
                            <div>
                                <span className="text-xs uppercase font-black text-slate-400 tracking-wider block mb-1">Simulated Total Students</span>
                                <h4 className="text-3xl sm:text-4xl font-black text-cyan-400">
                                    {simulatedTotals.projectedStudents.toLocaleString()}
                                    {simulatedTotals.totalStudentGain !== 0 && (
                                        <span className={`text-base font-bold ml-2 ${simulatedTotals.totalStudentGain > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            ({simulatedTotals.totalStudentGain > 0 ? `+${simulatedTotals.totalStudentGain}` : simulatedTotals.totalStudentGain})
                                        </span>
                                    )}
                                </h4>
                            </div>
                            <div className="border-l border-slate-700/80 pl-8">
                                <span className="text-xs uppercase font-black text-slate-400 tracking-wider block mb-1">Projected Total Revenue</span>
                                <h4 className="text-3xl sm:text-4xl font-black text-emerald-400">
                                    Rs. {simulatedTotals.projectedRevenue.toLocaleString()}
                                </h4>
                            </div>
                            <div className="border-l border-slate-700/80 pl-8">
                                <span className="text-xs uppercase font-black text-amber-400 tracking-wider block mb-1">Net Revenue Gain</span>
                                <h4 className={`text-3xl sm:text-4xl font-black flex items-center gap-2 ${simulatedTotals.totalGain >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {simulatedTotals.totalGain >= 0 ? `+Rs. ${simulatedTotals.totalGain.toLocaleString()}` : `-Rs. ${Math.abs(simulatedTotals.totalGain).toLocaleString()}`}
                                    <span className="text-sm font-black text-emerald-400 bg-emerald-500/25 px-2.5 py-1 rounded-xl border border-emerald-500/40">
                                        {simulatedTotals.percentageGain >= 0 ? `+${simulatedTotals.percentageGain}%` : `${simulatedTotals.percentageGain}%`}
                                    </span>
                                </h4>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* 🏆 4. COORDINATOR PERFORMANCE & CHANNEL BREAKDOWN CARDS 🏆 */}
            <div className="bg-[#111827]/90 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-slate-700/80 shadow-2xl">
                
                {/* Header Row: Title, Scope Badge, Search, Sort & Layout Switcher */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-6 pb-5 border-b border-slate-700/60">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h4 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wider flex items-center gap-3">
                                <Award size={28} className="text-amber-400 shrink-0" />
                                Coordinator Performance & Channel Breakdown
                            </h4>
                            <span className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 shadow-sm ${
                                localFilters.batchId === 'All'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                            }`}>
                                <Layers size={13} />
                                {localFilters.batchId === 'All' 
                                    ? '🌐 All Batches Combined (Lifetime)' 
                                    : `📌 ${batches.find(b => String(b.id) === String(localFilters.batchId))?.name || `Batch #${localFilters.batchId}`}`}
                            </span>
                        </div>
                        <p className="text-sm sm:text-base text-slate-300 font-semibold mt-1">
                            Exact Campaign Assigned Leads ➔ Paid Conversion • Plan ratios (Monthly vs Full Pay)
                        </p>
                    </div>

                    <div className="flex items-center gap-4 flex-wrap">
                        
                        {/* Search Coordinator */}
                        <div className="relative">
                            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Search coordinator..."
                                value={staffSearchQuery}
                                onChange={(e) => setStaffSearchQuery(e.target.value)}
                                className="bg-black/60 border border-slate-700 rounded-2xl pl-11 pr-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none focus:border-amber-400/80 w-52 sm:w-64 font-bold shadow-inner"
                            />
                        </div>

                        {/* Sort Dropdown */}
                        <select 
                            value={staffSortBy}
                            onChange={(e) => setStaffSortBy(e.target.value)}
                            className="bg-black/60 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm font-black text-slate-200 outline-none cursor-pointer hover:border-slate-500 transition-colors shadow-inner"
                        >
                            <option value="revenue">Sort: Highest Revenue</option>
                            <option value="students">Sort: Most Students</option>
                            <option value="share">Sort: Revenue Share %</option>
                            <option value="openSem">Sort: Open Seminar Conversion %</option>
                            <option value="newInq">Sort: New Inquiry Conversion %</option>
                            {simulationMode && <option value="simGain">Sort: Highest Simulated Gain</option>}
                        </select>

                        {/* Layout Toggle: Grid vs Table */}
                        <div className="flex items-center bg-black/60 border border-slate-700 rounded-2xl p-1 shadow-inner">
                            <button
                                onClick={() => setStaffViewLayout('grid')}
                                className={`p-2 rounded-xl text-sm font-bold transition-all ${staffViewLayout === 'grid' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                title="Grid View"
                            >
                                <LayoutGrid size={18} />
                            </button>
                            <button
                                onClick={() => setStaffViewLayout('table')}
                                className={`p-2 rounded-xl text-sm font-bold transition-all ${staffViewLayout === 'table' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                title="Table View"
                            >
                                <TableIcon size={18} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Batch Switcher inside Section 4 */}
                {batches.length > 0 && (
                    <div className="flex items-center gap-2 mb-6 p-2.5 bg-black/60 rounded-2xl border border-slate-700/80 overflow-x-auto custom-scrollbar shadow-inner">
                        <span className="text-xs font-black uppercase text-slate-400 tracking-wider ml-1 mr-1 shrink-0 flex items-center gap-1.5">
                            <Tag size={13} className="text-cyan-400" /> Switch Batch:
                        </span>
                        <button
                            onClick={() => setLocalFilters(prev => ({ ...prev, batchId: 'All' }))}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
                                localFilters.batchId === 'All'
                                    ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                                    : 'bg-white/5 text-slate-300 border-white/10 hover:border-amber-400/50 hover:text-white'
                            }`}
                        >
                            All Batches (Combined)
                        </button>
                        {batches.map(b => {
                            const isSelected = String(localFilters.batchId) === String(b.id);
                            return (
                                <button
                                    key={b.id}
                                    onClick={() => setLocalFilters(prev => ({ ...prev, batchId: String(b.id) }))}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border ${
                                        isSelected
                                            ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white border-cyan-300 shadow-[0_0_15px_rgba(99,102,241,0.5)]'
                                            : 'bg-white/5 text-slate-300 border-white/10 hover:border-cyan-400/50 hover:text-white'
                                    }`}
                                >
                                    {b.name}
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Aggregate Lifetime Notice when All Batches is Active */}
                {localFilters.batchId === 'All' && (
                    <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-200 text-xs sm:text-sm font-semibold">
                        <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                        <span>
                            <strong className="text-amber-300">Lifetime Aggregate View:</strong> Currently showing all-time cumulative leads & students across all batches. To view the exact numbers for a specific campaign (e.g. 2027 සැප්තැම්බර්), click the batch buttons above.
                        </span>
                    </div>
                )}

                {/* VIEW MODE 1: MODERN EXECUTIVE GRID VIEW */}
                {staffViewLayout === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        {displayedStaffData.map((staff, idx) => (
                            <div 
                                key={staff.id || idx}
                                className={`bg-[#0d131f] rounded-3xl border-2 transition-all duration-300 shadow-2xl flex flex-col justify-between overflow-hidden ${
                                    staff.isSimulated 
                                        ? 'border-amber-400 ring-4 ring-amber-400/30 shadow-[0_0_35px_rgba(245,158,11,0.3)]' 
                                        : 'border-slate-700/80 hover:border-indigo-500/70 hover:shadow-indigo-500/20'
                                }`}
                            >
                                <div className="p-6">
                                    
                                    {/* 1. Header: Avatar, Name, Badges & Total Revenue */}
                                    <div className="flex items-start justify-between gap-4 mb-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-2xl shadow-lg border border-white/20 shrink-0">
                                                {staff.name.charAt(0)}
                                            </div>
                                            <div>
                                                <h5 className="font-black text-white text-xl sm:text-2xl tracking-wide">{staff.name}</h5>
                                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                                    <span className="text-xs sm:text-sm text-cyan-300 font-black uppercase bg-cyan-500/20 px-3 py-1 rounded-xl border border-cyan-500/40 shadow-sm">
                                                        {staff.studentCount} Paid Students
                                                    </span>
                                                    <span className="text-xs sm:text-sm text-slate-300 font-bold uppercase bg-white/5 px-2.5 py-1 rounded-xl border border-white/10">
                                                        {staff.revenueShare}% Share
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <span className="text-lg sm:text-xl font-black text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-4 py-2.5 rounded-2xl shadow-md whitespace-nowrap">
                                            Rs. {staff.totalRevenue.toLocaleString()}
                                        </span>
                                    </div>

                                    {/* 🌟 2. OVERALL ENROLLED CONVERSION RATE & LEADS POOL 🌟 */}
                                    <div className="bg-gradient-to-r from-blue-950/60 via-indigo-950/60 to-slate-900 rounded-2xl p-4 sm:p-5 border border-indigo-500/40 my-4 shadow-md">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs sm:text-sm font-black text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                                                <Award size={18} className="text-indigo-400" /> Overall Enrolled Conversion:
                                            </span>
                                            <span className="text-base font-black text-white bg-indigo-500/30 border border-indigo-500/60 px-3.5 py-1 rounded-xl">
                                                {staff.overallConversionRate}% Rate
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs sm:text-sm text-slate-200 font-bold mb-2.5">
                                            <span>{staff.studentCount} Paid Students</span>
                                            <span className="text-slate-400">
                                                {staff.poolLeads > 0 ? `out of ${staff.poolLeads} Assigned Leads` : 'Direct / Unassigned Pool'}
                                            </span>
                                        </div>
                                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                                            <div 
                                                className="h-3 rounded-full bg-gradient-to-r from-blue-500 via-indigo-400 to-purple-400 transition-all duration-500"
                                                style={{ width: `${Math.min(100, staff.overallConversionRate)}%` }}
                                            ></div>
                                        </div>
                                    </div>

                                    {/* 🎯 3. Channel Performance Split (Open Seminar vs New Inquiries) */}
                                    <div className="bg-black/50 rounded-2xl p-4 sm:p-5 border border-white/10 my-4">
                                        <div className="text-xs sm:text-sm font-black text-slate-300 uppercase tracking-wider mb-4 flex items-center justify-between">
                                            <span className="flex items-center gap-2">
                                                <Target size={16} className="text-amber-400" /> Campaign Conversion Breakdown:
                                            </span>
                                            <span className="text-xs text-slate-400 font-bold">Assigned ➔ Paid</span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            
                                            {/* Open Seminar Channel Card */}
                                            <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-md">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-black text-amber-300 uppercase flex items-center gap-1.5">
                                                        <Target size={16} /> Open Sem
                                                    </span>
                                                    <span className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl border ${
                                                        staff.openSemIsMet 
                                                            ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' 
                                                            : 'bg-amber-500/25 text-amber-300 border-amber-500/50'
                                                    }`}>
                                                        {staff.openSemConversionRate}% Conv
                                                    </span>
                                                </div>

                                                {/* Assigned Leads vs Paid Count */}
                                                <div className="flex items-center justify-between py-2 px-3 bg-black/70 rounded-xl border border-white/10 my-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Assigned</span>
                                                        <span className="text-base sm:text-lg font-black text-slate-100">{staff.openSemAssigned}</span>
                                                    </div>
                                                    <div className="text-slate-400 font-black text-sm">➔</div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-xs font-bold text-amber-400 uppercase">Paid</span>
                                                        <span className="text-base sm:text-lg font-black text-amber-300">{staff.openSemCount}</span>
                                                    </div>
                                                </div>

                                                {/* Mini Progress Bar vs Target Goal */}
                                                <div className="mt-1">
                                                    <div className="flex justify-between items-center text-xs sm:text-sm text-slate-300 font-semibold mb-1">
                                                        <span>Target: {openSemTarget}%</span>
                                                        <span className={staff.openSemIsMet ? 'text-emerald-400 font-black' : 'text-amber-400 font-black'}>
                                                            {staff.openSemAchieved}% Goal
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                                        <div 
                                                            className={`h-2.5 rounded-full transition-all duration-500 ${staff.openSemIsMet ? 'bg-emerald-400' : 'bg-amber-400'}`} 
                                                            style={{ width: `${Math.min(100, staff.openSemConversionRate)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <span className="text-sm font-black text-slate-100 mt-3 pt-2.5 border-t border-white/10 truncate block">
                                                    Rs. {staff.openSemRev.toLocaleString()}
                                                </span>
                                            </div>

                                            {/* New Inquiry Channel Card */}
                                            <div className="bg-fuchsia-500/10 border-2 border-fuchsia-500/30 rounded-2xl p-4 flex flex-col justify-between shadow-md">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm font-black text-fuchsia-300 uppercase flex items-center gap-1.5">
                                                        <Zap size={16} /> New Inq
                                                    </span>
                                                    <span className={`text-xs sm:text-sm font-black px-2.5 py-1 rounded-xl border ${
                                                        staff.newInqIsMet 
                                                            ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50' 
                                                            : 'bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/50'
                                                    }`}>
                                                        {staff.newInqConversionRate}% Conv
                                                    </span>
                                                </div>

                                                {/* Assigned Leads vs Paid Count */}
                                                <div className="flex items-center justify-between py-2 px-3 bg-black/70 rounded-xl border border-white/10 my-2.5">
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-bold text-slate-400 uppercase">Assigned</span>
                                                        <span className="text-base sm:text-lg font-black text-slate-100">{staff.newInqAssigned}</span>
                                                    </div>
                                                    <div className="text-slate-400 font-black text-sm">➔</div>
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-xs font-bold text-fuchsia-400 uppercase">Paid</span>
                                                        <span className="text-base sm:text-lg font-black text-fuchsia-300">{staff.newInqCount}</span>
                                                    </div>
                                                </div>

                                                {/* Mini Progress Bar vs Target Goal */}
                                                <div className="mt-1">
                                                    <div className="flex justify-between items-center text-xs sm:text-sm text-slate-300 font-semibold mb-1">
                                                        <span>Target: {newInqTarget}%</span>
                                                        <span className={staff.newInqIsMet ? 'text-emerald-400 font-black' : 'text-fuchsia-400 font-black'}>
                                                            {staff.newInqAchieved}% Goal
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                                                        <div 
                                                            className={`h-2.5 rounded-full transition-all duration-500 ${staff.newInqIsMet ? 'bg-emerald-400' : 'bg-fuchsia-400'}`} 
                                                            style={{ width: `${Math.min(100, staff.newInqConversionRate)}%` }}
                                                        ></div>
                                                    </div>
                                                </div>

                                                <span className="text-sm font-black text-slate-100 mt-3 pt-2.5 border-t border-white/10 truncate block">
                                                    Rs. {staff.newInqRev.toLocaleString()}
                                                </span>
                                            </div>

                                        </div>
                                    </div>

                                    {/* 💳 4. Payment Plan Split (Monthly vs Full Pay vs Installment) */}
                                    <div className="bg-black/50 p-5 rounded-2xl border border-white/10 my-4">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            
                                            {/* Monthly */}
                                            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30">
                                                <span className="text-xs sm:text-sm font-black text-cyan-300 uppercase tracking-widest block mb-1">Monthly</span>
                                                <div className="flex items-center justify-center gap-1.5 my-1.5">
                                                    <span className="text-xl sm:text-2xl font-black text-white">{staff.monthlyCount}</span>
                                                    <span className="text-xs sm:text-sm font-black text-cyan-300">({staff.monthlyPct}%)</span>
                                                </div>
                                                <span className="text-xs sm:text-sm text-slate-300 block font-bold truncate">Rs. {staff.monthlyRev.toLocaleString()}</span>
                                            </div>

                                            {/* Full Pay */}
                                            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30">
                                                <span className="text-xs sm:text-sm font-black text-purple-300 uppercase tracking-widest block mb-1">Full Pay</span>
                                                <div className="flex items-center justify-center gap-1.5 my-1.5">
                                                    <span className="text-xl sm:text-2xl font-black text-white">{staff.fullCount}</span>
                                                    <span className="text-xs sm:text-sm font-black text-purple-300">({staff.fullPct}%)</span>
                                                </div>
                                                <span className="text-xs sm:text-sm text-slate-300 block font-bold truncate">Rs. {staff.fullRev.toLocaleString()}</span>
                                            </div>

                                            {/* Installment */}
                                            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                                                <span className="text-xs sm:text-sm font-black text-amber-300 uppercase tracking-widest block mb-1">Installment</span>
                                                <div className="flex items-center justify-center gap-1.5 my-1.5">
                                                    <span className="text-xl sm:text-2xl font-black text-white">{staff.installCount}</span>
                                                    <span className="text-xs sm:text-sm font-black text-amber-300">({staff.installPct}%)</span>
                                                </div>
                                                <span className="text-xs sm:text-sm text-slate-300 block font-bold truncate">Rs. {staff.installRev.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        {/* Plan Ratio Display (e.g. 9 : 11 ratio) */}
                                        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs sm:text-sm px-1 flex-wrap gap-2">
                                            <span className="text-slate-300 font-black flex items-center gap-2">
                                                <Percent size={16} className="text-indigo-400" /> Monthly : Full Ratio:
                                            </span>
                                            <span className="font-black text-indigo-200 bg-indigo-500/25 border border-indigo-500/50 px-3.5 py-1.5 rounded-xl text-sm sm:text-base">
                                                {staff.monthlyFullRatio} ({staff.monthlyPct}% : {staff.fullPct}%)
                                            </span>
                                        </div>
                                    </div>

                                </div>

                                {/* 5. 🔥 WHAT-IF CONVERSION SIMULATOR BOX (ACTIVE IN SIMULATION MODE) 🔥 */}
                                {simulationMode && (
                                    <div className="p-6 bg-gradient-to-b from-amber-500/20 via-slate-900/95 to-black/95 border-t-2 border-amber-400/60 rounded-b-3xl animate-fade-in">
                                        
                                        {/* Simulator Control Header with Direct Typing Box & Stepper Buttons */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                            <div>
                                                <span className="text-sm sm:text-base font-black text-amber-300 uppercase tracking-wider flex items-center gap-2">
                                                    <Sliders size={18} className="text-amber-400" /> Target Conversion Rate:
                                                </span>
                                                <span className="text-xs sm:text-sm text-slate-300 font-semibold block mt-1">
                                                    Baseline: <strong className="text-white font-bold">{staff.baseRate}%</strong> ({staff.studentCount} / {staff.poolLeads > 0 ? staff.poolLeads : '~' + staff.studentCount} leads)
                                                </span>
                                            </div>

                                            {/* Manual Direct Typing Input Box with + and - Steppers */}
                                            <div className="flex items-center gap-2 bg-black/90 border-2 border-amber-400 rounded-2xl p-1.5 shadow-2xl focus-within:ring-4 focus-within:ring-amber-400/40">
                                                <button
                                                    onClick={() => handleStepRate(staff.name, staff.simRate, -1)}
                                                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-lg flex items-center justify-center transition-all"
                                                    title="Decrease 1%"
                                                >
                                                    <Minus size={16} />
                                                </button>
                                                
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={staff.rawSimRate}
                                                    onChange={(e) => handleSimulationRateChange(staff.name, e.target.value)}
                                                    onBlur={() => handleSimulationRateBlur(staff.name, staff.baseRate)}
                                                    className="w-16 bg-transparent text-center font-black text-amber-300 text-2xl outline-none"
                                                    title="Type target percentage directly (e.g. 70)"
                                                />
                                                <span className="text-base font-black text-amber-400 pr-1">%</span>

                                                <button
                                                    onClick={() => handleStepRate(staff.name, staff.simRate, 1)}
                                                    className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-black text-lg flex items-center justify-center transition-all"
                                                    title="Increase 1%"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Slider Control */}
                                        <input 
                                            type="range"
                                            min="10"
                                            max="100"
                                            step="1"
                                            value={staff.simRate}
                                            onChange={(e) => handleSimulationRateChange(staff.name, e.target.value)}
                                            className="w-full accent-amber-400 cursor-pointer h-3 bg-slate-800 rounded-lg my-2.5"
                                        />

                                        {/* Quick Preset Boost Buttons */}
                                        <div className="flex items-center justify-between gap-2 my-3 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => handleQuickBoost(staff.name, staff.simRate, 5)}
                                                    className="px-3.5 py-1.5 bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 rounded-xl text-xs sm:text-sm font-black transition-all"
                                                >
                                                    +5%
                                                </button>
                                                <button 
                                                    onClick={() => handleQuickBoost(staff.name, staff.simRate, 10)}
                                                    className="px-3.5 py-1.5 bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 rounded-xl text-xs sm:text-sm font-black transition-all"
                                                >
                                                    +10%
                                                </button>
                                                <button 
                                                    onClick={() => handleQuickBoost(staff.name, staff.simRate, 15)}
                                                    className="px-3.5 py-1.5 bg-amber-500/25 hover:bg-amber-500/40 text-amber-300 border border-amber-500/50 rounded-xl text-xs sm:text-sm font-black transition-all"
                                                >
                                                    +15%
                                                </button>
                                            </div>
                                            <button 
                                                onClick={() => handleSimulationRateChange(staff.name, staff.baseRate)}
                                                className="px-3.5 py-1.5 text-xs sm:text-sm text-slate-400 hover:text-rose-400 font-black uppercase transition-colors rounded-xl border border-white/10 hover:border-rose-400/50"
                                            >
                                                Reset
                                            </button>
                                        </div>

                                        {/* Live Proportional Calculation Results Box */}
                                        <div className="mt-4 bg-black/80 p-5 rounded-2xl border border-white/20 space-y-3 text-sm">
                                            
                                            {/* Enrolled Headcount Shift */}
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-300 font-bold">Enrolled Students:</span>
                                                <span className="font-extrabold text-white text-base">
                                                    {staff.studentCount} <span className="text-slate-500">➔</span> <strong className="text-cyan-300 text-lg">{staff.simStudents}</strong>
                                                    {staff.deltaStudents !== 0 && (
                                                        <span className={`ml-2 text-sm font-black ${staff.deltaStudents > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            ({staff.deltaStudents > 0 ? `+${staff.deltaStudents}` : staff.deltaStudents})
                                                        </span>
                                                    )}
                                                </span>
                                            </div>

                                            {/* Scaled Monthly & Full in Exact Ratio */}
                                            <div className="flex items-center justify-between text-xs sm:text-sm text-slate-300 pt-2.5 border-t border-white/10 flex-wrap gap-2">
                                                <span className="font-bold">Scaled Plans ({staff.monthlyFullRatio}):</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-cyan-300 font-black">
                                                        M: {staff.monthlyCount} ➔ {staff.simMonthly} {staff.deltaMonthly !== 0 && `(${staff.deltaMonthly > 0 ? `+${staff.deltaMonthly}` : staff.deltaMonthly})`}
                                                    </span>
                                                    <span className="text-slate-500 font-bold">•</span>
                                                    <span className="text-purple-300 font-black">
                                                        F: {staff.fullCount} ➔ {staff.simFull} {staff.deltaFull !== 0 && `(${staff.deltaFull > 0 ? `+${staff.deltaFull}` : staff.deltaFull})`}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Projected Revenue & Net Gain */}
                                            <div className="flex items-center justify-between pt-3 border-t border-white/15">
                                                <div>
                                                    <span className="text-xs uppercase font-black tracking-wider text-slate-400 block mb-0.5">Projected Revenue</span>
                                                    <span className="text-lg sm:text-xl font-black text-white">Rs. {staff.simRevenue.toLocaleString()}</span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-xs uppercase font-black tracking-wider text-emerald-400 block mb-0.5">Net Gain</span>
                                                    <span className={`text-lg sm:text-xl font-black ${staff.deltaRevenue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                        {staff.deltaRevenue >= 0 ? `+Rs. ${Math.round(staff.deltaRevenue).toLocaleString()}` : `-Rs. ${Math.abs(Math.round(staff.deltaRevenue)).toLocaleString()}`}
                                                        <span className="text-xs sm:text-sm text-slate-300 font-bold ml-1.5">
                                                            ({staff.gainPercentage > 0 ? `+${staff.gainPercentage}%` : `${staff.gainPercentage}%`})
                                                        </span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    /* VIEW MODE 2: HIGH-DENSITY EXECUTIVE TABLE VIEW */
                    <div className="overflow-x-auto rounded-3xl border border-slate-700/70 shadow-2xl">
                        <table className="w-full text-left border-collapse text-sm sm:text-base">
                            <thead>
                                <tr className="bg-slate-900 text-slate-200 uppercase font-black tracking-wider text-xs sm:text-sm border-b border-slate-700">
                                    <th className="p-5 pl-6">Coordinator</th>
                                    <th className="p-5 text-center">Paid Students</th>
                                    <th className="p-5 text-right">Revenue (LKR)</th>
                                    <th className="p-5 text-center text-amber-300">Open Sem (Assigned ➔ Paid)</th>
                                    <th className="p-5 text-center text-amber-300">Open Sem Conv %</th>
                                    <th className="p-5 text-center text-fuchsia-300">New Inq (Assigned ➔ Paid)</th>
                                    <th className="p-5 text-center text-fuchsia-300">New Inq Conv %</th>
                                    <th className="p-5 text-center text-indigo-300">Monthly : Full Ratio</th>
                                    {simulationMode && (
                                        <>
                                            <th className="p-5 text-center text-amber-300">Target %</th>
                                            <th className="p-5 text-center text-cyan-300">Sim Students</th>
                                            <th className="p-5 text-right text-emerald-300">Projected Rev</th>
                                            <th className="p-5 text-right text-amber-300">Net Gain</th>
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800 bg-black/60 font-semibold">
                                {displayedStaffData.map((staff, idx) => (
                                    <tr key={staff.id || idx} className="hover:bg-slate-800/60 transition-colors">
                                        <td className="p-5 pl-6 font-bold text-white flex items-center gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-base shadow-md">
                                                {staff.name.charAt(0)}
                                            </div>
                                            <span className="font-black text-white text-base">{staff.name}</span>
                                        </td>
                                        <td className="p-5 text-center font-black text-cyan-300 text-base">{staff.studentCount}</td>
                                        <td className="p-5 text-right font-black text-emerald-400 text-base">Rs. {staff.totalRevenue.toLocaleString()}</td>
                                        <td className="p-5 text-center font-bold text-amber-300">
                                            {staff.openSemAssigned} ➔ {staff.openSemCount}
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1 rounded-xl font-black text-xs sm:text-sm ${staff.openSemIsMet ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50' : 'bg-amber-500/25 text-amber-300 border border-amber-500/50'}`}>
                                                {staff.openSemConversionRate}% ({staff.openSemAchieved}% Goal)
                                            </span>
                                        </td>
                                        <td className="p-5 text-center font-bold text-fuchsia-300">
                                            {staff.newInqAssigned} ➔ {staff.newInqCount}
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1 rounded-xl font-black text-xs sm:text-sm ${staff.newInqIsMet ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50' : 'bg-fuchsia-500/25 text-fuchsia-300 border border-fuchsia-500/50'}`}>
                                                {staff.newInqConversionRate}% ({staff.newInqAchieved}% Goal)
                                            </span>
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className="font-black text-indigo-200 bg-indigo-500/25 px-3.5 py-1 rounded-xl border border-indigo-500/50 text-sm">
                                                {staff.monthlyFullRatio} ({staff.monthlyPct}% : {staff.fullPct}%)
                                            </span>
                                        </td>
                                        {simulationMode && (
                                            <>
                                                <td className="p-5 text-center">
                                                    <input 
                                                        type="number"
                                                        min="1"
                                                        max="100"
                                                        value={staff.rawSimRate}
                                                        onChange={(e) => handleSimulationRateChange(staff.name, e.target.value)}
                                                        onBlur={() => handleSimulationRateBlur(staff.name, staff.baseRate)}
                                                        className="w-16 bg-black/90 text-center font-black text-amber-300 border-2 border-amber-400 rounded-xl px-2 py-1 text-base outline-none focus:border-amber-400 shadow-md"
                                                    />
                                                </td>
                                                <td className="p-5 text-center font-black text-cyan-300 text-base">
                                                    {staff.simStudents} 
                                                    {staff.deltaStudents !== 0 && (
                                                        <span className={`text-xs ml-1.5 ${staff.deltaStudents > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                            ({staff.deltaStudents > 0 ? `+${staff.deltaStudents}` : staff.deltaStudents})
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-5 text-right font-black text-emerald-400 text-base">
                                                    Rs. {staff.simRevenue.toLocaleString()}
                                                </td>
                                                <td className={`p-5 text-right font-black text-base ${staff.deltaRevenue >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {staff.deltaRevenue >= 0 ? `+Rs. ${Math.round(staff.deltaRevenue).toLocaleString()}` : `-Rs. ${Math.abs(Math.round(staff.deltaRevenue)).toLocaleString()}`}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

            </div>

            {/* 📚 5. SUBJECT PERFORMANCE & ENROLLMENT BREAKDOWN 📚 */}
            {stats.subjectStats.length > 0 && (
                <div className="bg-[#111827]/90 backdrop-blur-2xl p-6 sm:p-8 rounded-3xl border border-slate-700/80 shadow-2xl">
                    <h4 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-3 mb-5">
                        <BookOpen size={24} className="text-cyan-400" />
                        Subject-wise Performance & Enrollment Breakdown
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                        {stats.subjectStats.map((sub, idx) => (
                            <div key={idx} className="bg-black/50 p-5 rounded-2xl border border-slate-700/60 shadow-inner">
                                <span className="text-sm font-black text-cyan-300 uppercase tracking-wider block truncate">
                                    {sub.name}
                                </span>
                                <h5 className="text-xl font-black text-white mt-1.5">
                                    Rs. {sub.revenue.toLocaleString()}
                                </h5>
                                <p className="text-xs sm:text-sm text-slate-300 font-semibold mt-1">
                                    {sub.studentsCount} Students • {sub.slips} Slips
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

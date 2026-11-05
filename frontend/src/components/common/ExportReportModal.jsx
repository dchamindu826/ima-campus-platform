import React, { useRef, useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
    X, Download, FileSpreadsheet, Image as ImageIcon, Users, Wallet, 
    Filter, Check, Copy, AlertCircle, Tag, Receipt, Gift, Clock, Sparkles,
    TrendingUp, Sliders, RotateCcw, ArrowUpRight, ArrowDownRight,
    UserCheck, Percent, Layers, DollarSign, Calculator, ChevronDown, ChevronUp,
    Search, BarChart3, LayoutGrid, Table as TableIcon
} from 'lucide-react';
import { toPng } from 'html-to-image'; 
import * as XLSX from 'xlsx';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, ResponsiveContainer } from 'recharts';
import toast from 'react-hot-toast';
import axios from '../../api/axios';

// Helper to get initials
const getStaffInitials = (name) => {
    if (!name || name === 'Unknown') return 'U';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return 'U';
    return parts.map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

// Helper for avatar colors based on name string
const getStaffAvatarColor = (str) => {
    const colors = [
        'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
        'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        'bg-purple-500/20 text-purple-400 border-purple-500/30',
        'bg-amber-500/20 text-amber-400 border-amber-500/30',
        'bg-pink-500/20 text-pink-400 border-pink-500/30',
        'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        'bg-blue-500/20 text-blue-400 border-blue-500/30'
    ];
    let hash = 0;
    for (let i = 0; i < (str || '').length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

export default function ExportReportModal({ onClose, payments, filters: initialFilters, businesses, batches: initialBatches }) {
    const reportRef = useRef(null);

    const [localFilters, setLocalFilters] = useState({
        businessId: initialFilters.businessId,
        batchId: initialFilters.batchId,
        classType: initialFilters.classType || 'All',
        type: 'All', 
        method: 'All', 
        acquisitionSource: 'All',
        subjectNames: [], 
        dateFrom: initialFilters.dateFrom,
        dateTo: initialFilters.dateTo
    });

    const [generatedImage, setGeneratedImage] = useState(null);
    const [fetchedBatches, setFetchedBatches] = useState(initialBatches || []);

    // 🔥 Staff Breakdown & Revenue Simulator States 🔥
    const [staffChannelFilter, setStaffChannelFilter] = useState('ALL'); // 'ALL' | 'OPEN_SEMINAR' | 'NEW_INQ' | 'DIRECT'
    const [simulationMode, setSimulationMode] = useState(false);
    const [simulationDeltas, setSimulationDeltas] = useState({}); // { [staffName]: deltaPercentage }
    const [staffSearchQuery, setStaffSearchQuery] = useState('');
    const [staffSortBy, setStaffSortBy] = useState('revenue'); // 'revenue' | 'students' | 'share' | 'simGain'
    const [staffViewLayout, setStaffViewLayout] = useState('grid'); // 'grid' | 'table'

    useEffect(() => {
        if (localFilters.businessId !== 'All') {
            axios.get(`/admin/batches/${localFilters.businessId}`)
                .then(res => setFetchedBatches(res.data.batches || res.data || []))
                .catch(err => console.error("Error fetching batches:", err));
        } else {
            setFetchedBatches(initialBatches || []);
        }
    }, [localFilters.businessId, initialBatches]);

    const localSubjects = useMemo(() => {
        let validPays = payments;
        if (localFilters.businessId !== 'All') validPays = validPays.filter(p => (p.businessId || p.business_id)?.toString() === localFilters.businessId.toString());
        if (localFilters.batchId !== 'All') validPays = validPays.filter(p => (p.batchId || p.batch_id)?.toString() === localFilters.batchId.toString());
        if (localFilters.classType && localFilters.classType !== 'All') validPays = validPays.filter(p => p.classType?.toString() === localFilters.classType.toString());
        if (localFilters.type !== 'All') validPays = validPays.filter(p => p.type === localFilters.type);

        const extracted = new Map();
        validPays.forEach(p => {
            if (localFilters.type === 'Monthly') {
                const gName = p.groupName || p.group;
                if (gName && gName !== 'Unknown' && gName !== 'No Group') {
                    if (!extracted.has(gName)) {
                        extracted.set(gName, { name: gName });
                    }
                }
            } else {
                const subs = p.subjectsList || p.subjects || p.courses || [];
                subs.forEach(s => {
                    const sName = s.name || s.courseName;
                    if (sName) {
                        const cleanName = sName.replace(/\s*-\s*(Full|Monthly|Installment)/i, '').trim();
                        if (!extracted.has(cleanName)) {
                            extracted.set(cleanName, { name: cleanName });
                        }
                    }
                });
            }
        });
        return Array.from(extracted.values());
    }, [payments, localFilters.businessId, localFilters.batchId, localFilters.classType, localFilters.type]);

    const handleLocalChange = (field, value) => {
        setLocalFilters(prev => {
            const updated = { ...prev, [field]: value };
            if (field === 'businessId') {
                updated.batchId = 'All'; updated.subjectNames = [];
            }
            if (field === 'batchId') {
                updated.subjectNames = [];
            }
            if (field === 'type' || field === 'classType') {
                updated.subjectNames = [];
            }
            return updated;
        });
    };

    const exportDataList = useMemo(() => {
        return payments.filter(p => {
            // 🔥 FIX: Include Post Pay and Free Card
            const validStatuses = ['Approved', 'Discount', 'Free Card', 'Post Pay'];
            if (!validStatuses.includes(p.status)) return false;

            const matchesBiz = localFilters.businessId === 'All' || (p.businessId || p.business_id)?.toString() === localFilters.businessId.toString();
            const matchesBatch = localFilters.batchId === 'All' || (p.batchId || p.batch_id)?.toString() === localFilters.batchId.toString();
            const matchesClassType = !localFilters.classType || localFilters.classType === 'All' || p.classType?.toString() === localFilters.classType.toString();
            const matchesType = localFilters.type === 'All' || p.type === localFilters.type;
            const matchesMethod = localFilters.method === 'All' || (localFilters.method === 'Online' ? (p.method === 'PayHere' || p.method === 'Online') : p.method === 'Slip');

            let matchesSubject = false;
            if (localFilters.subjectNames.length === 0 || localFilters.subjectNames.length === localSubjects.length) {
                matchesSubject = true;
            } else {
                if (localFilters.type === 'Monthly') {
                    const gName = p.groupName || p.group;
                    matchesSubject = localFilters.subjectNames.includes(gName);
                } else {
                    const subs = p.subjectsList || p.subjects || p.courses || [];
                    matchesSubject = subs.some(s => {
                        const cleanName = (s.name || s.courseName || '').replace(/\s*-\s*(Full|Monthly|Installment)/i, '').trim();
                        return localFilters.subjectNames.includes(cleanName);
                    });
                }
            }

            let matchesDate = true;
            if (localFilters.dateFrom || localFilters.dateTo) {
                const payDate = new Date(p.date);
                if (localFilters.dateFrom && payDate < new Date(localFilters.dateFrom)) matchesDate = false;
                if (localFilters.dateTo && payDate > new Date(localFilters.dateTo)) matchesDate = false;
            }

            const matchesSource = !localFilters.acquisitionSource || localFilters.acquisitionSource === 'All' || p.inquirySource === localFilters.acquisitionSource;

            return matchesBiz && matchesBatch && matchesClassType && matchesType && matchesMethod && matchesSubject && matchesDate && matchesSource;
        });
    }, [payments, localFilters, localSubjects]);

    const getAdjustedAmount = (p) => {
        const isUpgrade = p.remark && p.remark.includes('[UPGRADE]');
        if (isUpgrade) {
            const previousPayments = payments.filter(op => 
                op.studentId === p.studentId && 
                op.batchId === p.batchId && 
                op.id !== p.id &&
                ['Approved', 'Discount', 'Free Card', 'Post Pay'].includes(op.status) &&
                new Date(op.date) < new Date(p.date)
            );
            const prevDuesPaid = previousPayments.reduce((sum, op) => sum + parseFloat(op.amount || 0), 0);
            return Math.max(0, parseFloat(p.amount || 0) - prevDuesPaid);
        }
        return parseFloat(p.amount || 0);
    };

    const stats = useMemo(() => {
        let totalRev = 0;
        let discountRev = 0;
        let fullRev = 0, monthlyRev = 0, installRev = 0;
        
        const uniqueStudents = new Set();
        const discountStudents = new Set();
        const freeCardStudents = new Set(); // 🔥 වෙනම සෙට් එකක් Free Card අයට
        const postPayStudents = new Set();  // 🔥 වෙනම සෙට් එකක් Post Pay අයට
        const dateMap = {};

        // 🔥 LEAD ACQUISITION BREAKDOWN: OPEN SEMINAR VS NEW INQUIRY
        let openSemRev = 0, openSemSlips = 0;
        const openSemStudents = new Set();
        let newInqRev = 0, newInqSlips = 0;
        const newInqStudents = new Set();
        let directRev = 0, directSlips = 0;
        const directStudents = new Set();

        const studentSubjectsCount = {}; 
        const subjectStats = {}; 

        // 🔥 STAFF ALLOCATION & PERFORMANCE BREAKDOWN MAP 🔥
        const staffStatsMap = {};

        exportDataList.forEach(p => {
            const amt = getAdjustedAmount(p);
            totalRev += amt;
            uniqueStudents.add(p.studentId); 

            // 🔥 Lead Source Breakdown
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

            if (p.status === 'Discount') {
                discountRev += amt;
                discountStudents.add(p.studentId);
            }
            
            // 🔥 වෙන් කරලා අඳුරගන්නවා
            if (p.status === 'Free Card') freeCardStudents.add(p.studentId);
            if (p.status === 'Post Pay') postPayStudents.add(p.studentId);

            const type = p.type?.toLowerCase() || '';
            let payTypeCategory = 'monthly';
            if (type.includes('full')) {
                fullRev += amt;
                payTypeCategory = 'full';
            } else if (type.includes('install')) {
                installRev += amt;
                payTypeCategory = 'install';
            } else {
                monthlyRev += amt;
                payTypeCategory = 'monthly';
            }

            // 🔥 Staff Breakdown Tracking
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
                    fullStudents: new Set(),
                    monthlyStudents: new Set(),
                    installStudents: new Set(),
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

            if (payTypeCategory === 'full') {
                st.fullRev += amt;
                st.fullStudents.add(p.studentId);
            } else if (payTypeCategory === 'install') {
                st.installRev += amt;
                st.installStudents.add(p.studentId);
            } else {
                st.monthlyRev += amt;
                st.monthlyStudents.add(p.studentId);
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

            const d = p.date;
            if (!dateMap[d]) dateMap[d] = 0;
            dateMap[d] += amt;

            const subs = p.subjectsList || p.subjects || p.courses || [];
            
            if (!studentSubjectsCount[p.studentId]) {
                studentSubjectsCount[p.studentId] = new Set();
            }

            subs.forEach(s => {
                const sName = (s.name || s.courseName || '').replace(/\s*-\s*(Full|Monthly|Installment)/i, '').trim();
                if (sName) {
                    studentSubjectsCount[p.studentId].add(sName);

                    if (!subjectStats[sName]) {
                        subjectStats[sName] = { 
                            name: sName, 
                            enrolled: new Set(), 
                            fullSet: new Set(),
                            monthlySet: new Set(),
                            installSet: new Set(),
                            freeCardSet: new Set(), // 🔥
                            postPaySet: new Set(),  // 🔥
                            revenue: 0 
                        };
                    }
                    
                    subjectStats[sName].enrolled.add(p.studentId);
                    
                    if (p.status === 'Free Card') {
                        subjectStats[sName].freeCardSet.add(p.studentId);
                    } else if (p.status === 'Post Pay') {
                        subjectStats[sName].postPaySet.add(p.studentId);
                    } else {
                        if (type.includes('full')) subjectStats[sName].fullSet.add(p.studentId);
                        else if (type.includes('install')) subjectStats[sName].installSet.add(p.studentId);
                        else subjectStats[sName].monthlySet.add(p.studentId);
                    }

                    if(s.price && p.status !== 'Free Card' && p.status !== 'Post Pay') {
                        // Apply custom overrides if they exist in remark CUSTOM_PRICES metadata
                        let actualPrice = parseFloat(s.price);
                        if (p.remark && p.remark.includes('[CUSTOM_PRICES:')) {
                            try {
                                const match = p.remark.match(/\[CUSTOM_PRICES:({.*?})\]/);
                                if (match) {
                                    const parsedMap = JSON.parse(match[1]);
                                    const sIdStr = String(s.id || s.course_id);
                                    if (parsedMap[sIdStr] !== undefined) {
                                        actualPrice = parseFloat(parsedMap[sIdStr]);
                                    }
                                }
                            } catch (e) {}
                        }
                        subjectStats[sName].revenue += actualPrice; 
                    }
                }
            });
        });

        let averageCount = 0;
        let averageRevenue = 0;

        Object.keys(studentSubjectsCount).forEach(stuId => {
            const subjectsSet = studentSubjectsCount[stuId];
            
            const stuPayments = exportDataList.filter(p => p.studentId === parseInt(stuId) || p.studentId === stuId);
            if (stuPayments.length === 0) return;

            const stuBizId = stuPayments[0].businessId || stuPayments[0].business_id;
            const stuBiz = businesses.find(b => b.id?.toString() === stuBizId?.toString());
            
            const isOL = stuBiz ? (stuBiz.name.toLowerCase().includes('o/l') || stuBiz.name.toLowerCase().includes('ordinary')) : false;

            if (isOL) {
                if (subjectsSet.size >= 9) {
                    averageCount++;
                    averageRevenue += stuPayments.reduce((sum, p) => sum + getAdjustedAmount(p), 0);
                }
            } else {
                let mainSubjectCount = 0;
                subjectsSet.forEach(subName => {
                    const nameLower = subName.toLowerCase();
                    if (!nameLower.includes('english') && !nameLower.includes('general') && !nameLower.includes('git')) {
                        mainSubjectCount++;
                    }
                });

                if (mainSubjectCount >= 3) {
                    averageCount++;
                    averageRevenue += stuPayments.reduce((sum, p) => sum + getAdjustedAmount(p), 0);
                }
            }
        });

        const formattedSubjectStats = Object.values(subjectStats).map(sub => ({
            name: sub.name,
            enrolledCount: sub.enrolled.size,
            fullCount: sub.fullSet.size,
            monthlyCount: sub.monthlySet.size,
            installCount: sub.installSet.size,
            freeCardCount: sub.freeCardSet.size, // 🔥
            postPayCount: sub.postPaySet.size,   // 🔥
            revenue: sub.revenue
        })).sort((a, b) => b.enrolledCount - a.enrolledCount);

        const barData = Object.keys(dateMap).sort().map(k => ({ date: k, revenue: dateMap[k] }));

        const totalCalcRev = (openSemRev + newInqRev + directRev) || 1;
        const openSemPercent = ((openSemRev / totalCalcRev) * 100).toFixed(1);
        const newInqPercent = ((newInqRev / totalCalcRev) * 100).toFixed(1);
        const directPercent = ((directRev / totalCalcRev) * 100).toFixed(1);

        const acquisition = {
            openSem: {
                revenue: openSemRev,
                slips: openSemSlips,
                students: openSemStudents.size,
                percent: openSemPercent
            },
            newInq: {
                revenue: newInqRev,
                slips: newInqSlips,
                students: newInqStudents.size,
                percent: newInqPercent
            },
            direct: {
                revenue: directRev,
                slips: directSlips,
                students: directStudents.size,
                percent: directPercent
            }
        };

        // 🔥 Format Staff Performance Stats
        const formattedStaffStats = Object.values(staffStatsMap).map(st => {
            const share = totalRev > 0 ? ((st.totalRevenue / totalRev) * 100) : 0;
            const openSemShare = openSemRev > 0 ? ((st.openSemRev / openSemRev) * 100) : 0;
            const newInqShare = newInqRev > 0 ? ((st.newInqRev / newInqRev) * 100) : 0;

            return {
                id: st.id,
                name: st.name,
                totalRevenue: st.totalRevenue,
                slips: st.slips,
                studentCount: st.students.size,
                fullRev: st.fullRev,
                monthlyRev: st.monthlyRev,
                installRev: st.installRev,
                fullCount: st.fullStudents.size,
                monthlyCount: st.monthlyStudents.size,
                installCount: st.installStudents.size,
                share: parseFloat(share.toFixed(1)),
                openSemRev: st.openSemRev,
                openSemSlips: st.openSemSlips,
                openSemStudents: st.openSemStudents.size,
                openSemShare: parseFloat(openSemShare.toFixed(1)),
                newInqRev: st.newInqRev,
                newInqSlips: st.newInqSlips,
                newInqStudents: st.newInqStudents.size,
                newInqShare: parseFloat(newInqShare.toFixed(1)),
                directRev: st.directRev,
                directSlips: st.directSlips,
                directStudents: st.directStudents.size
            };
        }).sort((a, b) => b.totalRevenue - a.totalRevenue);

        return {
            totalRevenue: totalRev,
            enrolled: uniqueStudents.size,
            discountRevenue: discountRev,
            discountEnrolled: discountStudents.size,
            freeCardEnrolled: freeCardStudents.size, // 🔥
            postPayEnrolled: postPayStudents.size,   // 🔥
            pieData: [
                { name: 'Full Pay', value: fullRev, color: '#10b981' },
                { name: 'Monthly', value: monthlyRev, color: '#3b82f6' },
                { name: 'Installments', value: installRev, color: '#f59e0b' }
            ].filter(d => d.value > 0),
            barData,
            averageCount,
            averageRevenue,
            subjectStats: formattedSubjectStats,
            acquisition, // 🔥 Lead Acquisition Breakdown
            staffStats: formattedStaffStats // 🔥 Staff Performance Breakdown
        };
    }, [exportDataList, businesses, payments]);

    // 🔥 INTERACTIVE WHAT-IF REVENUE SIMULATION & PROJECTION ENGINE 🔥
    const staffAnalysis = useMemo(() => {
        const staffList = stats.staffStats || [];
        
        let filtered = staffList.filter(s => 
            s.name.toLowerCase().includes(staffSearchQuery.toLowerCase().trim())
        );

        let totalBaselineRev = 0;
        let totalProjectedRev = 0;
        let totalBaselineStudents = 0;
        let totalProjectedStudents = 0;

        const staffItems = filtered.map(st => {
            let baseRev = st.totalRevenue;
            let baseStudents = st.studentCount;
            let baseSlips = st.slips;
            let baseShare = st.share;

            if (staffChannelFilter === 'OPEN_SEMINAR') {
                baseRev = st.openSemRev;
                baseStudents = st.openSemStudents;
                baseSlips = st.openSemSlips;
                baseShare = st.openSemShare;
            } else if (staffChannelFilter === 'NEW_INQ') {
                baseRev = st.newInqRev;
                baseStudents = st.newInqStudents;
                baseSlips = st.newInqSlips;
                baseShare = st.newInqShare;
            } else if (staffChannelFilter === 'DIRECT') {
                baseRev = st.directRev;
                baseStudents = st.directStudents;
                baseSlips = st.directSlips;
                baseShare = stats.acquisition?.direct?.revenue > 0 
                    ? parseFloat(((st.directRev / stats.acquisition.direct.revenue) * 100).toFixed(1)) 
                    : 0;
            }

            const delta = simulationDeltas[st.name] || 0;
            const multiplier = 1 + (delta / 100);
            const projectedRev = Math.max(0, Math.round(baseRev * multiplier));
            const revDiff = projectedRev - baseRev;
            const projectedStudents = Math.max(0, Math.round(baseStudents * multiplier));
            const studentDiff = projectedStudents - baseStudents;

            const projectedFull = Math.max(0, Math.round(st.fullRev * multiplier));
            const projectedMonthly = Math.max(0, Math.round(st.monthlyRev * multiplier));
            const projectedInstall = Math.max(0, Math.round(st.installRev * multiplier));

            totalBaselineRev += baseRev;
            totalProjectedRev += projectedRev;
            totalBaselineStudents += baseStudents;
            totalProjectedStudents += projectedStudents;

            return {
                ...st,
                channelRev: baseRev,
                channelStudents: baseStudents,
                channelSlips: baseSlips,
                channelShare: baseShare,
                delta,
                projectedRev,
                revDiff,
                projectedStudents,
                studentDiff,
                projectedFull,
                projectedMonthly,
                projectedInstall
            };
        });

        if (staffSortBy === 'revenue') {
            staffItems.sort((a, b) => b.channelRev - a.channelRev);
        } else if (staffSortBy === 'students') {
            staffItems.sort((a, b) => b.channelStudents - a.channelStudents);
        } else if (staffSortBy === 'share') {
            staffItems.sort((a, b) => b.channelShare - a.channelShare);
        } else if (staffSortBy === 'simGain') {
            staffItems.sort((a, b) => b.revDiff - a.revDiff);
        }

        const netRevGain = totalProjectedRev - totalBaselineRev;
        const netRevGainPercent = totalBaselineRev > 0 ? ((netRevGain / totalBaselineRev) * 100).toFixed(1) : '0.0';
        const netStudentGain = totalProjectedStudents - totalBaselineStudents;

        return {
            items: staffItems,
            totalBaselineRev,
            totalProjectedRev,
            netRevGain,
            netRevGainPercent,
            totalBaselineStudents,
            totalProjectedStudents,
            netStudentGain
        };
    }, [stats.staffStats, staffChannelFilter, simulationDeltas, staffSearchQuery, staffSortBy, stats.acquisition]);

    const handleSetDelta = (staffName, value) => {
        const parsed = parseFloat(value);
        setSimulationDeltas(prev => ({
            ...prev,
            [staffName]: isNaN(parsed) ? 0 : parsed
        }));
    };

    const handleApplyAllPreset = (pct) => {
        const next = {};
        (stats.staffStats || []).forEach(s => {
            next[s.name] = pct;
        });
        setSimulationDeltas(next);
        toast.success(`Simulation: Set ${pct >= 0 ? '+' : ''}${pct}% on all staff`);
    };

    const handleApplyTopPreset = (pct, topCount = 3) => {
        const next = {};
        const sorted = [...(stats.staffStats || [])].sort((a, b) => b.totalRevenue - a.totalRevenue);
        sorted.forEach((s, idx) => {
            if (idx < topCount) next[s.name] = pct;
            else next[s.name] = 0;
        });
        setSimulationDeltas(next);
        toast.success(`Simulation: Boosted top ${topCount} coordinators by +${pct}%`);
    };

    const handleResetSimulation = () => {
        setSimulationDeltas({});
        toast.success("Simulation values reset to baseline");
    };

    const bizName = localFilters.businessId === 'All' ? 'All Businesses' : businesses.find(b => b.id?.toString() === localFilters.businessId.toString())?.name || 'Unknown Business';
    const batchName = localFilters.batchId === 'All' ? 'All Batches' : fetchedBatches.find(b => b.id?.toString() === localFilters.batchId.toString())?.name || 'Unknown Batch';
    const dateRange = (localFilters.dateFrom || localFilters.dateTo) ? `${localFilters.dateFrom || 'Any'} to ${localFilters.dateTo || 'Any'}` : 'All Time';

    const handleExportImage = () => {
        if (!reportRef.current) return toast.error("Report area not ready!");
        const toastId = toast.loading("Processing report image...");
        
        toPng(reportRef.current, { cacheBust: true, backgroundColor: '#0f172a', pixelRatio: 2 })
            .then((dataUrl) => {
                setGeneratedImage(dataUrl);
                toast.success("Image generated successfully!", { id: toastId });
            })
            .catch((err) => {
                console.error("Image Export Error:", err);
                toast.error("Failed to generate image. Please check console.", { id: toastId });
            });
    };

    const handleCopyImage = async () => {
        try {
            const response = await fetch(generatedImage);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast.success("Image copied to clipboard! You can paste it anywhere.");
        } catch (err) {
            toast.error("Failed to copy. Right-Click the image and select 'Copy Image'.");
        }
    };

    const handleDownloadImage = () => {
        const link = document.createElement('a');
        link.download = `IMA_Report_${bizName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.png`;
        link.href = generatedImage;
        link.click();
        toast.success("Download started!");
    };

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        // 1. Dashboard summary sheet
        const summaryData = [
            ["IMA CAMPUS - FINANCIAL REPORT DASHBOARD"],
            ["Report Date:", new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
            ["Business Unit:", bizName],
            ["Batch:", batchName],
            ["Timeline:", dateRange],
            [],
            ["KEY FINANCIAL METRICS"],
            ["Total Verified Revenue", stats.totalRevenue, "LKR"],
            ["Total Unique Active Students", stats.enrolled, "Students"],
            ["Special Discount Revenue", stats.discountRevenue, "LKR"],
            ["Discount Enrolled Students", stats.discountEnrolled, "Students"],
            ["Free Card Enrolled Students", stats.freeCardEnrolled, "Students"],
            ["Post Pay Enrolled Students", stats.postPayEnrolled, "Students"],
            ["Core Average Students (A/L 3 Sub / O/L 9 Sub)", stats.averageCount, "Students"],
            ["Est. Revenue from Core Average", stats.averageRevenue, "LKR"],
            [],
            ["STUDENT ACQUISITION BREAKDOWN (LEAD SOURCES)"],
            ["Acquisition Channel", "Unique Students", "Payment Slips", "Revenue (LKR)", "Revenue Share (%)"],
            ["Open Seminar", stats.acquisition?.openSem?.students || 0, stats.acquisition?.openSem?.slips || 0, stats.acquisition?.openSem?.revenue || 0, `${stats.acquisition?.openSem?.percent || 0}%`],
            ["New Inquiry", stats.acquisition?.newInq?.students || 0, stats.acquisition?.newInq?.slips || 0, stats.acquisition?.newInq?.revenue || 0, `${stats.acquisition?.newInq?.percent || 0}%`],
            ["Direct / Untracked", stats.acquisition?.direct?.students || 0, stats.acquisition?.direct?.slips || 0, stats.acquisition?.direct?.revenue || 0, `${stats.acquisition?.direct?.percent || 0}%`],
            [],
            ["STAFF ALLOCATION & PERFORMANCE BREAKDOWN"],
            ["Staff Member", "Acquisition Channel", "Revenue Share (%)", "Verified Revenue (LKR)", "Unique Students", "Payment Slips", "Full Pay (LKR)", "Monthly (LKR)", "Installment (LKR)", "Open Sem Rev (LKR)", "New Inq Rev (LKR)"],
            ...(stats.staffStats || []).map(st => [
                st.name,
                "All Channels",
                `${st.share}%`,
                st.totalRevenue,
                st.studentCount,
                st.slips,
                st.fullRev,
                st.monthlyRev,
                st.installRev,
                st.openSemRev,
                st.newInqRev
            ]),
            [],
            ["SUBJECT PERFORMANCE BREAKDOWN"],
            ["Subject Name", "Enrolled", "Full Pay", "Monthly", "Installment", "Free Card", "Post Pay", "Revenue (LKR)"]
        ];

        stats.subjectStats.forEach(sub => {
            summaryData.push([
                sub.name,
                sub.enrolledCount,
                sub.fullCount,
                sub.monthlyCount,
                sub.installCount,
                sub.freeCardCount,
                sub.postPayCount,
                sub.revenue
            ]);
        });

        const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary Dashboard");

        // 2. Staff Performance dedicated sheet
        const staffSheetData = (stats.staffStats || []).map(st => {
            const delta = simulationDeltas[st.name] || 0;
            const projected = Math.round(st.totalRevenue * (1 + delta / 100));
            return {
                "Staff Member": st.name,
                "Revenue Share (%)": `${st.share}%`,
                "Verified Revenue (LKR)": st.totalRevenue,
                "Unique Students": st.studentCount,
                "Payment Slips": st.slips,
                "Full Pay (LKR)": st.fullRev,
                "Monthly Pay (LKR)": st.monthlyRev,
                "Installments (LKR)": st.installRev,
                "Open Seminar Rev (LKR)": st.openSemRev,
                "Open Seminar Students": st.openSemStudents,
                "New Inquiries Rev (LKR)": st.newInqRev,
                "New Inquiries Students": st.newInqStudents,
                "Direct Rev (LKR)": st.directRev,
                "Simulated Growth (%)": `${delta >= 0 ? '+' : ''}${delta}%`,
                "Projected Revenue (LKR)": projected,
                "Projected Net Gain (LKR)": projected - st.totalRevenue
            };
        });
        const wsStaff = XLSX.utils.json_to_sheet(staffSheetData);
        XLSX.utils.book_append_sheet(wb, wsStaff, "Staff Performance");

        // 3. Standard Payments sheet
        const standardPaymentsList = exportDataList.filter(p => !(p.remark && p.remark.includes('[UPGRADE]')));
        const standardData = standardPaymentsList.map(p => ({
            "Date": p.date,
            "Student ID": p.studentNo,
            "Student Name": p.studentName,
            "Phone": p.phone,
            "Business": p.business,
            "Batch": p.batch,
            "Assigned Staff": p.assignedStaffName || 'Unassigned / Direct',
            "Lead Source": p.inquirySource === 'OPEN_SEMINAR' ? 'Open Seminar' : (p.inquirySource === 'NEW_INQ' ? 'New Inquiry' : 'Direct'),
            "Type": p.type,
            "Method": p.method,
            "Status": p.status, 
            "Amount (LKR)": getAdjustedAmount(p)
        }));
        const wsStandard = XLSX.utils.json_to_sheet(standardData);
        XLSX.utils.book_append_sheet(wb, wsStandard, "Standard Payments");

        // 4. Upgrade Payments sheet
        const upgradePaymentsList = exportDataList.filter(p => p.remark && p.remark.includes('[UPGRADE]'));
        const upgradeData = upgradePaymentsList.map(p => {
            const previousPayments = payments.filter(op => 
                op.studentId === p.studentId && 
                op.batchId === p.batchId && 
                op.id !== p.id &&
                ['Approved', 'Discount', 'Free Card', 'Post Pay'].includes(op.status) &&
                new Date(op.date) < new Date(p.date)
            );
            const prevDuesPaid = previousPayments.reduce((sum, op) => sum + parseFloat(op.amount || 0), 0);
            return {
                "Date": p.date,
                "Student ID": p.studentNo,
                "Student Name": p.studentName,
                "Phone": p.phone,
                "Business": p.business,
                "Batch": p.batch,
                "Assigned Staff": p.assignedStaffName || 'Unassigned / Direct',
                "Lead Source": p.inquirySource === 'OPEN_SEMINAR' ? 'Open Seminar' : (p.inquirySource === 'NEW_INQ' ? 'New Inquiry' : 'Direct'),
                "Method": p.method,
                "Status": p.status,
                "Upgrade Raw Amount": parseFloat(p.amount || 0),
                "Previous Paid": prevDuesPaid,
                "Adjusted Net Amount (LKR)": getAdjustedAmount(p),
                "Remark": p.remark
            };
        });
        const wsUpgrade = XLSX.utils.json_to_sheet(upgradeData);
        XLSX.utils.book_append_sheet(wb, wsUpgrade, "Upgrade Payments");

        // Save file
        let fileSuffix = '';
        if (localFilters.classType === '1') fileSuffix = '_Theory';
        else if (localFilters.classType === '2') fileSuffix = '_Paper';
        XLSX.writeFile(wb, `IMA_Financial_Report${fileSuffix}_${new Date().toISOString().slice(0,10)}.xlsx`);
        toast.success("Excel Report Exported Successfully!");
    };

    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-2 md:p-6 backdrop-blur-md overflow-hidden">
            
            {generatedImage && (
                <div className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in duration-300">
                    <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
                        <button onClick={handleCopyImage} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"><Copy size={18}/> Copy to Clipboard</button>
                        <button onClick={handleDownloadImage} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"><Download size={18}/> Download Image</button>
                        <button onClick={() => setGeneratedImage(null)} className="bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all border border-white/10"><X size={18}/> Close Preview</button>
                    </div>
                    <div className="relative max-w-full max-h-[75vh] overflow-hidden rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/10">
                        <img src={generatedImage} alt="Report Preview" className="max-w-full max-h-[75vh] object-contain" />
                    </div>
                    <p className="text-slate-400 text-sm mt-5 bg-black/40 px-6 py-2 rounded-xl border border-white/5 flex items-center gap-2">
                        <AlertCircle size={16} className="text-yellow-500" />
                        Tip: You can also Right-Click on the image above and select "Copy image".
                    </p>
                </div>
            )}

            <div className="bg-[#1e293b] border border-white/10 rounded-[2.5rem] w-full max-w-[98vw] h-full max-h-[96vh] shadow-2xl flex flex-col relative overflow-hidden transition-all">
                
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 border-b border-white/10 gap-4 bg-slate-800/50 shrink-0">
                    <div>
                        <h3 className="text-2xl font-black text-white flex items-center gap-3">
                            <FileSpreadsheet className="text-emerald-500" size={28} /> Export Financial Report
                        </h3>
                        <p className="text-slate-400 text-xs mt-1">Review verified payments, free access, and actual student enrollments.</p>
                    </div>
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button onClick={handleExportExcel} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-emerald-600/20"><Download size={18}/> Excel</button>
                        <button onClick={handleExportImage} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-lg shadow-blue-600/20"><ImageIcon size={18}/> Image Report</button>
                        <button onClick={onClose} className="bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white p-3 rounded-2xl transition-all"><X size={24} /></button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
                    
                    {/* Sidebar Filters */}
                    <div className="w-full lg:w-80 bg-slate-900/40 border-r border-white/5 p-6 overflow-y-auto custom-scrollbar flex flex-col gap-5 shrink-0">
                        <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Filter size={14}/> Refining Filters</h4>
                        
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Business Unit</label>
                                <select value={localFilters.businessId} onChange={e => handleLocalChange('businessId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-white font-medium outline-none focus:border-emerald-500">
                                    <option value="All">All Businesses</option>
                                    {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Academic Batch</label>
                                <select value={localFilters.batchId} onChange={e => handleLocalChange('batchId', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-sm text-white font-medium outline-none focus:border-emerald-500">
                                    <option value="All">All Batches</option>
                                    {fetchedBatches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Class Type Stream</label>
                                <div className="grid grid-cols-3 gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                                    <button
                                        type="button"
                                        onClick={() => handleLocalChange('classType', 'All')}
                                        className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            (!localFilters.classType || localFilters.classType === 'All')
                                                ? 'bg-emerald-600 text-white shadow-sm'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleLocalChange('classType', '1')}
                                        className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            localFilters.classType === '1'
                                                ? 'bg-sky-600 text-white shadow-sm'
                                                : 'text-sky-400 hover:text-white'
                                        }`}
                                    >
                                        📘 Theory
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleLocalChange('classType', '2')}
                                        className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                            localFilters.classType === '2'
                                                ? 'bg-amber-600 text-white shadow-sm'
                                                : 'text-amber-400 hover:text-white'
                                        }`}
                                    >
                                        📝 Paper
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Payment Type</label>
                                    <select value={localFilters.type} onChange={e => handleLocalChange('type', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white font-medium outline-none">
                                        <option value="All">All Types</option>
                                        <option value="Full">Full</option>
                                        <option value="Monthly">Monthly</option>
                                        <option value="Installment">Installment</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Method</label>
                                    <select value={localFilters.method} onChange={e => handleLocalChange('method', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white font-medium outline-none">
                                        <option value="All">All Methods</option>
                                        <option value="Slip">Slip</option>
                                        <option value="Online">Online</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Lead Source</label>
                                <select value={localFilters.acquisitionSource || 'All'} onChange={e => handleLocalChange('acquisitionSource', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white font-medium outline-none focus:border-amber-500">
                                    <option value="All">All Lead Sources</option>
                                    <option value="OPEN_SEMINAR">Open Seminar</option>
                                    <option value="NEW_INQ">New Inquiry</option>
                                    <option value="DIRECT">Direct / Other</option>
                                </select>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">
                                    {localFilters.type === 'Monthly' ? 'Monthly Groups' : 'Subjects'} (Multi-Select)
                                </label>
                                <div className="bg-black/40 border border-white/10 rounded-xl p-3 max-h-40 overflow-y-auto custom-scrollbar flex flex-col gap-2">
                                    {localSubjects.map((s, idx) => {
                                        const isChecked = localFilters.subjectNames.length === 0 || localFilters.subjectNames.includes(s.name);
                                        return (
                                            <label key={idx} className="flex items-start gap-3 cursor-pointer group">
                                                <input 
                                                    type="checkbox" className="hidden" checked={isChecked}
                                                    onChange={(e) => {
                                                        if (localFilters.subjectNames.length === 0) {
                                                            const allNames = localSubjects.map(sub => sub.name);
                                                            handleLocalChange('subjectNames', allNames.filter(name => name !== s.name));
                                                        } else if (e.target.checked) {
                                                            handleLocalChange('subjectNames', [...localFilters.subjectNames, s.name]);
                                                        } else {
                                                            handleLocalChange('subjectNames', localFilters.subjectNames.filter(name => name !== s.name));
                                                        }
                                                    }}
                                                />
                                                <div className={`w-4 h-4 mt-0.5 rounded flex items-center justify-center border transition-all ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'bg-black/50 border-white/20 group-hover:border-emerald-500/50'}`}>
                                                    {isChecked && <Check size={12} className="text-white stroke-[3]" />}
                                                </div>
                                                <span className={`text-xs transition-colors ${isChecked ? 'text-emerald-400 font-bold' : 'text-slate-300 group-hover:text-white'}`}>{s.name}</span>
                                            </label>
                                        );
                                    })}
                                    {localSubjects.length === 0 && <span className="text-xs text-slate-500 italic">No subjects available</span>}
                                </div>
                                {localSubjects.length > 0 && (
                                    <div className="flex gap-4 px-1 mt-1">
                                        <button onClick={() => handleLocalChange('subjectNames', [])} className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold uppercase tracking-wider transition-colors">Select All</button>
                                        <button onClick={() => handleLocalChange('subjectNames', ['NONE'])} className="text-[10px] text-slate-400 hover:text-red-400 font-bold uppercase tracking-wider transition-colors">Clear All</button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">From</label>
                                    <input type="date" value={localFilters.dateFrom} onChange={e => handleLocalChange('dateFrom', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">To</label>
                                    <input type="date" value={localFilters.dateTo} onChange={e => handleLocalChange('dateTo', e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none" />
                                </div>
                            </div>
                        </div>

                        {/* 🔥 UNIQUE STUDENTS VS SLIPS SUMMARY 🔥 */}
                        <div className="mt-auto flex flex-col gap-3 pt-6 border-t border-white/5">
                            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl shrink-0 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><Users size={12}/> Unique Active Students</p>
                                    <p className="text-2xl font-black text-white">{stats.enrolled}</p>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 border border-slate-700/50 p-4 rounded-2xl shrink-0 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1 flex items-center gap-1.5"><Receipt size={12}/> Total Payment Slips</p>
                                    <p className="text-xl font-bold text-slate-300">{exportDataList.length}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-[#0f172a] custom-scrollbar flex justify-center items-start">
                        <div ref={reportRef} className="bg-[#0f172a] text-white p-10 w-full max-w-6xl rounded-[2rem] border border-white/5">
                            
                            <div className="flex justify-between items-start border-b border-white/10 pb-8 mb-8">
                                <div>
                                    <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">IMA CAMPUS</h1>
                                    <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px] mt-1">Verified Payment & Enrollment Summary</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Generation Date</p>
                                    <p className="text-sm font-bold text-slate-300">{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Business Unit</p>
                                    <p className="text-xs font-bold text-emerald-400 truncate">{bizName}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Batch</p>
                                    <p className="text-xs font-bold text-blue-400 truncate">{batchName}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Timeline</p>
                                    <p className="text-xs font-bold text-orange-400 truncate">{dateRange}</p>
                                </div>
                                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Verified Slips</p>
                                    <p className="text-xs font-bold text-slate-300">{exportDataList.length} Processed Transactions</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                                <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                                    <Wallet className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" />
                                    <p className="text-emerald-100/70 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Total Verified Revenue</p>
                                    <h2 className="text-5xl font-black text-white relative z-10"><span className="text-2xl font-light mr-2">LKR</span>{stats.totalRevenue.toLocaleString()}</h2>
                                </div>
                                <div className="bg-gradient-to-br from-blue-600 to-blue-800 p-8 rounded-[2rem] shadow-2xl relative overflow-hidden group">
                                    <Users className="absolute -right-4 -bottom-4 text-white/10 w-32 h-32 rotate-12" />
                                    <p className="text-blue-100/70 text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Total Unique Students Active</p>
                                    <h2 className="text-5xl font-black text-white relative z-10">{stats.enrolled}<span className="text-2xl font-light ml-2">Students</span></h2>
                                </div>
                            </div>

                            {/* 🔥 SEPARATED FREE CARD AND POST PAY CARDS 🔥 */}
                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-10">
                                <div className="col-span-2 bg-gradient-to-br from-cyan-600 to-cyan-800 p-6 md:p-8 rounded-[2rem] shadow-xl relative overflow-hidden group border border-cyan-500/30 flex justify-between items-center">
                                    <div>
                                        <p className="text-cyan-100/80 text-[10px] md:text-xs font-bold uppercase tracking-widest mb-2 relative z-10">Special Discount Rev.</p>
                                        <h2 className="text-3xl font-black text-white relative z-10"><span className="text-lg font-light mr-2">LKR</span>{stats.discountRevenue.toLocaleString()}</h2>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-cyan-100/80 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Students</p>
                                        <h3 className="text-2xl font-black text-white relative z-10">{stats.discountEnrolled}</h3>
                                    </div>
                                    <Tag className="absolute -right-4 -bottom-4 text-white/10 w-28 h-28 rotate-12" />
                                </div>

                                <div className="bg-gradient-to-br from-pink-600 to-pink-800 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group border border-pink-500/30">
                                    <Gift className="absolute -right-2 -bottom-2 text-white/10 w-20 h-20 rotate-12" />
                                    <p className="text-pink-100/80 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Free Card</p>
                                    <h2 className="text-3xl font-black text-white relative z-10">{stats.freeCardEnrolled}<span className="text-sm font-light ml-1">Sts</span></h2>
                                </div>

                                <div className="bg-gradient-to-br from-orange-600 to-orange-800 p-6 rounded-[2rem] shadow-xl relative overflow-hidden group border border-orange-500/30">
                                    <Clock className="absolute -right-2 -bottom-2 text-white/10 w-20 h-20 rotate-12" />
                                    <p className="text-orange-100/80 text-[10px] font-bold uppercase tracking-widest mb-1 relative z-10">Post Pay (Temp)</p>
                                    <h2 className="text-3xl font-black text-white relative z-10">{stats.postPayEnrolled}<span className="text-sm font-light ml-1">Sts</span></h2>
                                </div>
                            </div>

                            {/* 🔥 STUDENT ACQUISITION & LEAD SOURCE BREAKDOWN 🔥 */}
                            <div className="mb-10 bg-slate-900/60 border border-white/10 rounded-[2rem] p-6 lg:p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
                                    <div>
                                        <h3 className="text-sm md:text-base font-black tracking-wide text-white uppercase flex items-center gap-2.5">
                                            <Sparkles className="text-amber-400 w-5 h-5" />
                                            Student Acquisition Breakdown (Lead Sources)
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Verified enrollment & revenue generated via Open Seminars vs New Inquiries
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 bg-black/40 px-3.5 py-2 rounded-xl border border-white/5 self-start sm:self-auto">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue:</span>
                                        <span className="text-xs font-black text-emerald-400">LKR {stats.totalRevenue.toLocaleString()}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {/* Open Seminar Card */}
                                    <div className="bg-gradient-to-br from-indigo-950/80 via-purple-950/70 to-slate-900/90 border border-indigo-500/30 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between group shadow-xl">
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                                    <Users size={12} className="text-indigo-400" /> Open Seminar
                                                </span>
                                                <span className="text-xs font-black text-indigo-300 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                                                    {stats.acquisition?.openSem?.percent || 0}%
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-indigo-200/70 uppercase tracking-widest">Revenue Collected</p>
                                            <h4 className="text-3xl font-black text-white mt-1 mb-4">
                                                <span className="text-base font-light text-indigo-300 mr-1.5">LKR</span>
                                                {(stats.acquisition?.openSem?.revenue || 0).toLocaleString()}
                                            </h4>
                                        </div>

                                        <div className="relative z-10 pt-4 border-t border-indigo-500/20 grid grid-cols-2 gap-3 text-xs">
                                            <div className="bg-black/40 p-2.5 rounded-xl border border-indigo-500/10">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Students</p>
                                                <p className="text-lg font-black text-indigo-300">{stats.acquisition?.openSem?.students || 0}</p>
                                            </div>
                                            <div className="bg-black/40 p-2.5 rounded-xl border border-indigo-500/10">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Slips</p>
                                                <p className="text-lg font-black text-slate-200">{stats.acquisition?.openSem?.slips || 0}</p>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden mt-4">
                                            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.acquisition?.openSem?.percent || 0}%` }}></div>
                                        </div>
                                    </div>

                                    {/* New Inquiry Card */}
                                    <div className="bg-gradient-to-br from-amber-950/80 via-orange-950/70 to-slate-900/90 border border-amber-500/30 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between group shadow-xl">
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                                                    <Tag size={12} className="text-amber-400" /> New Inquiries
                                                </span>
                                                <span className="text-xs font-black text-amber-300 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                                                    {stats.acquisition?.newInq?.percent || 0}%
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-amber-200/70 uppercase tracking-widest">Revenue Collected</p>
                                            <h4 className="text-3xl font-black text-white mt-1 mb-4">
                                                <span className="text-base font-light text-amber-300 mr-1.5">LKR</span>
                                                {(stats.acquisition?.newInq?.revenue || 0).toLocaleString()}
                                            </h4>
                                        </div>

                                        <div className="relative z-10 pt-4 border-t border-amber-500/20 grid grid-cols-2 gap-3 text-xs">
                                            <div className="bg-black/40 p-2.5 rounded-xl border border-amber-500/10">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Students</p>
                                                <p className="text-lg font-black text-amber-300">{stats.acquisition?.newInq?.students || 0}</p>
                                            </div>
                                            <div className="bg-black/40 p-2.5 rounded-xl border border-amber-500/10">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Slips</p>
                                                <p className="text-lg font-black text-slate-200">{stats.acquisition?.newInq?.slips || 0}</p>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden mt-4">
                                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500" style={{ width: `${stats.acquisition?.newInq?.percent || 0}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Direct / Other Card */}
                                    <div className="bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90 border border-slate-700/40 p-6 rounded-2xl relative overflow-hidden flex flex-col justify-between group shadow-xl">
                                        <div className="relative z-10">
                                            <div className="flex items-center justify-between mb-3">
                                                <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg">
                                                    Direct / Untracked
                                                </span>
                                                <span className="text-xs font-black text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                                                    {stats.acquisition?.direct?.percent || 0}%
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revenue Collected</p>
                                            <h4 className="text-3xl font-black text-white mt-1 mb-4">
                                                <span className="text-base font-light text-slate-400 mr-1.5">LKR</span>
                                                {(stats.acquisition?.direct?.revenue || 0).toLocaleString()}
                                            </h4>
                                        </div>

                                        <div className="relative z-10 pt-4 border-t border-slate-700/30 grid grid-cols-2 gap-3 text-xs">
                                            <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Students</p>
                                                <p className="text-lg font-black text-slate-300">{stats.acquisition?.direct?.students || 0}</p>
                                            </div>
                                            <div className="bg-black/40 p-2.5 rounded-xl border border-white/5">
                                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Slips</p>
                                                <p className="text-lg font-black text-slate-200">{stats.acquisition?.direct?.slips || 0}</p>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden mt-4">
                                            <div className="bg-slate-600 h-full rounded-full transition-all duration-500" style={{ width: `${stats.acquisition?.direct?.percent || 0}%` }}></div>
                                        </div>
                                    </div>
                                </div>

                                {/* 🔥 STAFF ALLOCATION & PERFORMANCE BREAKDOWN + WHAT-IF SIMULATOR 🔥 */}
                                <div className="border-t border-white/10 my-8 pt-8">
                                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
                                        <div>
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-2 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
                                                    <Users size={18} />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm md:text-base font-black tracking-wide text-white uppercase flex items-center gap-2">
                                                        Staff Allocation & Performance Breakdown
                                                        <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/20 px-2 py-0.5 rounded-full border border-indigo-500/30 lowercase">
                                                            {staffAnalysis.items.length} coordinators
                                                        </span>
                                                    </h4>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        Numbers assigned staff wise breakdown • Monthly, Full, Installment split & student counts
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Controls: Channel Filter Pills + Simulator Toggle + View Switcher */}
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {/* Channel Pills */}
                                            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5 text-xs font-semibold">
                                                <button
                                                    onClick={() => setStaffChannelFilter('ALL')}
                                                    className={`px-3 py-1.5 rounded-lg transition-all ${staffChannelFilter === 'ALL' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    All Channels
                                                </button>
                                                <button
                                                    onClick={() => setStaffChannelFilter('OPEN_SEMINAR')}
                                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${staffChannelFilter === 'OPEN_SEMINAR' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    <Users size={12} className="text-indigo-300"/> Open Seminar
                                                </button>
                                                <button
                                                    onClick={() => setStaffChannelFilter('NEW_INQ')}
                                                    className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${staffChannelFilter === 'NEW_INQ' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    <Tag size={12} className="text-amber-300"/> New Inquiries
                                                </button>
                                            </div>

                                            {/* View Layout Toggle (Grid / Table) */}
                                            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/5">
                                                <button
                                                    onClick={() => setStaffViewLayout('grid')}
                                                    title="Grid View"
                                                    className={`p-1.5 rounded-lg transition-all ${staffViewLayout === 'grid' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    <LayoutGrid size={15}/>
                                                </button>
                                                <button
                                                    onClick={() => setStaffViewLayout('table')}
                                                    title="Table View"
                                                    className={`p-1.5 rounded-lg transition-all ${staffViewLayout === 'table' ? 'bg-white/20 text-white' : 'text-slate-400 hover:text-white'}`}
                                                >
                                                    <TableIcon size={15}/>
                                                </button>
                                            </div>

                                            {/* What-If Simulator Toggle Button */}
                                            <button
                                                onClick={() => setSimulationMode(!simulationMode)}
                                                className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all border ${
                                                    simulationMode
                                                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-emerald-400/50 shadow-lg shadow-emerald-500/20'
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                                                }`}
                                            >
                                                <Sliders size={14} />
                                                {simulationMode ? 'Simulation Mode Active' : 'What-If Simulator'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Simulation Mode Active Banner */}
                                    {simulationMode && (
                                        <div className="mb-6 p-5 rounded-2xl bg-gradient-to-br from-emerald-950/70 via-slate-900/90 to-teal-950/60 border border-emerald-500/30 shadow-2xl relative overflow-hidden backdrop-blur-xl animate-in fade-in duration-300">
                                            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-emerald-500/20">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="text-emerald-400 w-4 h-4 animate-spin" />
                                                        <h5 className="text-xs font-black text-emerald-300 uppercase tracking-widest">
                                                            Interactive Revenue Impact Projection & What-If Simulator
                                                        </h5>
                                                    </div>
                                                    <p className="text-[11px] text-slate-300 mt-1">
                                                        Adjust coordinator conversion/target percentages below to project revenue growth and student enrollment impacts in real-time.
                                                    </p>
                                                </div>

                                                {/* Quick Preset Buttons */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[10px] text-emerald-300/70 uppercase font-black tracking-wider mr-1">Quick Scenarios:</span>
                                                    <button onClick={() => handleApplyAllPreset(5)} className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all">+5% All</button>
                                                    <button onClick={() => handleApplyAllPreset(10)} className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all">+10% All</button>
                                                    <button onClick={() => handleApplyAllPreset(15)} className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold transition-all">+15% All</button>
                                                    <button onClick={() => handleApplyTopPreset(20, 3)} className="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-bold transition-all">Top 3 +20%</button>
                                                    <button onClick={handleResetSimulation} className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-[11px] font-bold transition-all flex items-center gap-1">
                                                        <RotateCcw size={11} /> Reset
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Simulation Summary Metrics */}
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                                <div className="bg-black/40 p-3 rounded-xl border border-white/5">
                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Baseline Verified Revenue</p>
                                                    <p className="text-base lg:text-lg font-black text-slate-200 mt-0.5">
                                                        <span className="text-[10px] font-light text-slate-400 mr-1">LKR</span>
                                                        {staffAnalysis.totalBaselineRev.toLocaleString()}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{staffAnalysis.totalBaselineStudents} students</p>
                                                </div>

                                                <div className="bg-emerald-950/60 p-3 rounded-xl border border-emerald-500/30">
                                                    <p className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">Simulated Projected Revenue</p>
                                                    <p className="text-base lg:text-lg font-black text-emerald-300 mt-0.5">
                                                        <span className="text-[10px] font-light text-emerald-400 mr-1">LKR</span>
                                                        {staffAnalysis.totalProjectedRev.toLocaleString()}
                                                    </p>
                                                    <p className="text-[10px] text-emerald-400/80 mt-0.5">{staffAnalysis.totalProjectedStudents} projected students</p>
                                                </div>

                                                <div className={`p-3 rounded-xl border ${staffAnalysis.netRevGain >= 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                                                    <p className="text-[9px] font-bold uppercase tracking-wider opacity-80">Expected Revenue Impact</p>
                                                    <p className="text-base lg:text-lg font-black mt-0.5 flex items-center gap-1">
                                                        {staffAnalysis.netRevGain >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                                                        <span>LKR {Math.abs(staffAnalysis.netRevGain).toLocaleString()}</span>
                                                    </p>
                                                    <p className="text-[10px] font-bold mt-0.5">
                                                        {staffAnalysis.netRevGain >= 0 ? '+' : ''}{staffAnalysis.netRevGainPercent}% Net Change
                                                    </p>
                                                </div>

                                                <div className="bg-indigo-950/50 p-3 rounded-xl border border-indigo-500/20">
                                                    <p className="text-[9px] text-indigo-300 font-bold uppercase tracking-wider">New Student Gain</p>
                                                    <p className="text-base lg:text-lg font-black text-white mt-0.5 flex items-center gap-1">
                                                        <Users size={16} className="text-indigo-400"/>
                                                        <span>{staffAnalysis.netStudentGain >= 0 ? `+${staffAnalysis.netStudentGain}` : staffAnalysis.netStudentGain}</span>
                                                        <span className="text-[10px] text-slate-400 font-normal">Students</span>
                                                    </p>
                                                    <p className="text-[10px] text-indigo-300/80 mt-0.5">Projected enrollment delta</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Search and Sort Sub-Bar */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-5">
                                        <div className="relative w-full sm:w-72">
                                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                            <input
                                                type="text"
                                                placeholder="Search coordinator name..."
                                                value={staffSearchQuery}
                                                onChange={(e) => setStaffSearchQuery(e.target.value)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                                            />
                                            {staffSearchQuery && (
                                                <button onClick={() => setStaffSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs">✕</button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-auto text-xs">
                                            <span className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">Sort by:</span>
                                            <select
                                                value={staffSortBy}
                                                onChange={(e) => setStaffSortBy(e.target.value)}
                                                className="bg-black/40 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="revenue">Highest Revenue</option>
                                                <option value="students">Most Students</option>
                                                <option value="share">Revenue Share %</option>
                                                {simulationMode && <option value="simGain">Highest Simulated Gain</option>}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Staff Grid View */}
                                    {staffViewLayout === 'grid' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                            {staffAnalysis.items.map((item, index) => {
                                                const avatarColor = getStaffAvatarColor(item.name);
                                                const initials = getStaffInitials(item.name);

                                                return (
                                                    <div 
                                                        key={item.name + index}
                                                        className={`p-5 rounded-2xl border transition-all duration-300 relative flex flex-col justify-between ${
                                                            simulationMode && item.delta !== 0
                                                                ? 'bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-900/95 border-emerald-500/40 shadow-xl shadow-emerald-950/20'
                                                                : 'bg-slate-950/60 border-white/10 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <div>
                                                            {/* Top Staff Header */}
                                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                                <div className="flex items-center gap-3">
                                                                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs ${avatarColor}`}>
                                                                        {initials}
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <h5 className="font-bold text-white text-sm tracking-tight">{item.name}</h5>
                                                                            <span className="text-[10px] font-black text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">#{index + 1}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 mt-0.5">
                                                                            <span className="text-[10px] text-slate-400 font-medium">
                                                                                OS: {item.openSemStudents} • NI: {item.newInqStudents}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="text-right">
                                                                    <span className="text-xs font-black text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
                                                                        {item.channelShare}%
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Revenue and Students Cards */}
                                                            <div className="bg-black/30 rounded-xl p-3 mb-3 border border-white/5">
                                                                <div className="flex items-baseline justify-between mb-1">
                                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                                        {simulationMode && item.delta !== 0 ? 'Projected Revenue' : 'Verified Revenue'}
                                                                    </span>
                                                                    {simulationMode && item.delta !== 0 && (
                                                                        <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${item.revDiff >= 0 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'}`}>
                                                                            {item.revDiff >= 0 ? '+' : ''}{item.delta}% (LKR {Math.abs(item.revDiff).toLocaleString()})
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h6 className="text-xl font-black text-white">
                                                                    <span className="text-xs font-light text-slate-400 mr-1">LKR</span>
                                                                    {(simulationMode ? item.projectedRev : item.channelRev).toLocaleString()}
                                                                </h6>
                                                                {simulationMode && item.delta !== 0 && (
                                                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                                                        Baseline: LKR {item.channelRev.toLocaleString()}
                                                                    </p>
                                                                )}
                                                            </div>

                                                            {/* Students & Slips Metrics */}
                                                            <div className="grid grid-cols-2 gap-2 mb-3">
                                                                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Students</p>
                                                                    <p className="text-sm font-black text-indigo-300 mt-0.5">
                                                                        {simulationMode ? item.projectedStudents : item.channelStudents}
                                                                        {simulationMode && item.studentDiff !== 0 && (
                                                                            <span className="text-[10px] text-emerald-400 font-bold ml-1">
                                                                                ({item.studentDiff >= 0 ? `+${item.studentDiff}` : item.studentDiff})
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <div className="bg-black/20 p-2.5 rounded-xl border border-white/5">
                                                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Paid Slips</p>
                                                                    <p className="text-sm font-black text-slate-200 mt-0.5">{item.channelSlips}</p>
                                                                </div>
                                                            </div>

                                                            {/* Monthly, Full, Installment Amounts Split */}
                                                            <div className="space-y-1.5 mb-3 bg-black/20 p-2.5 rounded-xl border border-white/5 text-[11px]">
                                                                <div className="flex justify-between items-center text-slate-400">
                                                                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Full Pay:
                                                                    </span>
                                                                    <span className="font-bold text-white">
                                                                        LKR {(simulationMode ? item.projectedFull : item.fullRev).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-slate-400">
                                                                    <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Monthly:
                                                                    </span>
                                                                    <span className="font-bold text-white">
                                                                        LKR {(simulationMode ? item.projectedMonthly : item.monthlyRev).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-slate-400">
                                                                    <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
                                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Installments:
                                                                    </span>
                                                                    <span className="font-bold text-white">
                                                                        LKR {(simulationMode ? item.projectedInstall : item.installRev).toLocaleString()}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Interactive Simulation Controls */}
                                                        {simulationMode && (
                                                            <div className="pt-3 border-t border-white/10 mt-1">
                                                                <div className="flex items-center justify-between mb-1.5">
                                                                    <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                                                                        <Sliders size={10}/> Target / Growth:
                                                                    </span>
                                                                    <div className="flex items-center gap-1">
                                                                        <input
                                                                            type="number"
                                                                            value={item.delta}
                                                                            onChange={(e) => handleSetDelta(item.name, e.target.value)}
                                                                            className="w-14 bg-black/60 border border-emerald-500/40 rounded px-1.5 py-0.5 text-right text-xs font-black text-emerald-400 focus:outline-none"
                                                                        />
                                                                        <span className="text-xs font-bold text-emerald-400">%</span>
                                                                    </div>
                                                                </div>

                                                                <input
                                                                    type="range"
                                                                    min="-50"
                                                                    max="100"
                                                                    step="1"
                                                                    value={item.delta}
                                                                    onChange={(e) => handleSetDelta(item.name, e.target.value)}
                                                                    className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-black/50 rounded-lg appearance-none"
                                                                />

                                                                <div className="flex items-center justify-between gap-1 mt-2">
                                                                    <button onClick={() => handleSetDelta(item.name, item.delta - 5)} className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-slate-300">-5%</button>
                                                                    <button onClick={() => handleSetDelta(item.name, item.delta + 5)} className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] text-emerald-300 font-bold">+5%</button>
                                                                    <button onClick={() => handleSetDelta(item.name, item.delta + 10)} className="px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-[10px] text-emerald-300 font-bold">+10%</button>
                                                                    <button onClick={() => handleSetDelta(item.name, item.delta + 20)} className="px-1.5 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-[10px] text-indigo-300 font-bold">+20%</button>
                                                                    <button onClick={() => handleSetDelta(item.name, 0)} className="px-1.5 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-[10px] text-red-300">0%</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Staff Table View */}
                                    {staffViewLayout === 'table' && (
                                        <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-2xl bg-slate-950/40">
                                            <table className="w-full text-left border-collapse text-xs">
                                                <thead>
                                                    <tr className="border-b border-white/10 bg-white/5 text-slate-400">
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">#</th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px]">Coordinator</th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-center">Share</th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-right">
                                                            {simulationMode ? 'Projected Revenue' : 'Verified Revenue'}
                                                        </th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-center">Students</th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-center">Slips</th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-right text-emerald-400">Full Pay</th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-right text-blue-400">Monthly</th>
                                                        <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-right text-amber-400">Installments</th>
                                                        {simulationMode && (
                                                            <th className="py-3 px-4 font-bold uppercase tracking-wider text-[10px] text-center text-emerald-300">Simulation Adjustment</th>
                                                        )}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {staffAnalysis.items.map((item, index) => {
                                                        const avatarColor = getStaffAvatarColor(item.name);
                                                        const initials = getStaffInitials(item.name);

                                                        return (
                                                            <tr key={item.name + index} className="hover:bg-white/[0.02] transition-colors">
                                                                <td className="py-3 px-4 font-bold text-slate-500 text-[11px]">#{index + 1}</td>
                                                                <td className="py-3 px-4">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center font-bold text-[10px] ${avatarColor}`}>
                                                                            {initials}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-bold text-white block">{item.name}</span>
                                                                            <span className="text-[10px] text-slate-500">OS: {item.openSemStudents} • NI: {item.newInqStudents}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 px-4 text-center">
                                                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                                        {item.channelShare}%
                                                                    </span>
                                                                </td>
                                                                <td className="py-3 px-4 text-right font-black text-white">
                                                                    <div>
                                                                        <span className="text-xs text-slate-400 font-light mr-1">LKR</span>
                                                                        {(simulationMode ? item.projectedRev : item.channelRev).toLocaleString()}
                                                                    </div>
                                                                    {simulationMode && item.delta !== 0 && (
                                                                        <span className={`text-[10px] font-bold ${item.revDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                            {item.revDiff >= 0 ? '+' : ''}LKR {item.revDiff.toLocaleString()} ({item.delta}%)
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-3 px-4 text-center font-bold text-indigo-300">
                                                                    {simulationMode ? item.projectedStudents : item.channelStudents}
                                                                    {simulationMode && item.studentDiff !== 0 && (
                                                                        <span className="text-[10px] text-emerald-400 ml-1">
                                                                            ({item.studentDiff >= 0 ? `+${item.studentDiff}` : item.studentDiff})
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="py-3 px-4 text-center font-bold text-slate-300">{item.channelSlips}</td>
                                                                <td className="py-3 px-4 text-right font-bold text-emerald-400">
                                                                    LKR {(simulationMode ? item.projectedFull : item.fullRev).toLocaleString()}
                                                                </td>
                                                                <td className="py-3 px-4 text-right font-bold text-blue-400">
                                                                    LKR {(simulationMode ? item.projectedMonthly : item.monthlyRev).toLocaleString()}
                                                                </td>
                                                                <td className="py-3 px-4 text-right font-bold text-amber-400">
                                                                    LKR {(simulationMode ? item.projectedInstall : item.installRev).toLocaleString()}
                                                                </td>
                                                                {simulationMode && (
                                                                    <td className="py-3 px-4 text-center">
                                                                        <div className="flex items-center justify-center gap-1.5">
                                                                            <input
                                                                                type="number"
                                                                                value={item.delta}
                                                                                onChange={(e) => handleSetDelta(item.name, e.target.value)}
                                                                                className="w-14 bg-black/60 border border-emerald-500/40 rounded px-1.5 py-0.5 text-right text-xs font-black text-emerald-400 focus:outline-none"
                                                                            />
                                                                            <span className="text-xs font-bold text-emerald-400">%</span>
                                                                            <button onClick={() => handleSetDelta(item.name, item.delta + 10)} className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">+10%</button>
                                                                            <button onClick={() => handleSetDelta(item.name, 0)} className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 text-[10px]">0</button>
                                                                        </div>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}

                                    {staffAnalysis.items.length === 0 && (
                                        <div className="p-8 text-center bg-black/20 rounded-2xl border border-white/5">
                                            <p className="text-slate-400 text-sm">No coordinator data found matching your query.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
                                <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 flex flex-col items-center">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 w-full text-center">Revenue Mix</h3>
                                    <div className="w-full min-h-[12rem] h-48">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie isAnimationActive={false} data={stats.pieData} innerRadius={50} outerRadius={70} paddingAngle={8} dataKey="value" stroke="none">
                                                    {stats.pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 mt-4 w-full">
                                        {stats.pieData.map((d, i) => (
                                            <div key={i} className="flex justify-between items-center text-[10px] font-bold text-slate-400 bg-black/20 p-2 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                                                    {d.name}
                                                </div>
                                                <span className="text-white">LKR {d.value.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="lg:col-span-2 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">Daily Collections Trend</h3>
                                    <div className="w-full min-h-[12rem] h-64">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={stats.barData}>
                                                <XAxis dataKey="date" stroke="#475569" fontSize={9} tickLine={false} axisLine={false} />
                                                <Bar isAnimationActive={false} dataKey="revenue" fill="#10b981" radius={[6, 6, 0, 0]} barSize={24} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10 border-t border-white/10 pt-8">
                                
                                <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 p-6 rounded-3xl border border-indigo-500/20 shadow-xl flex flex-col justify-center">
                                    <h3 className="text-indigo-400 font-bold text-sm tracking-widest uppercase mb-4">Core Average Metrics</h3>
                                    <p className="text-xs text-slate-400 mb-6">Students enrolled in 3 main subjects (A/L) or 9 subjects (O/L).</p>
                                    
                                    <div className="bg-black/30 p-4 rounded-2xl mb-4 border border-white/5">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Total Average Students</p>
                                        <p className="text-3xl font-black text-white">{stats.averageCount} <span className="text-sm font-medium text-slate-400">Students</span></p>
                                    </div>

                                    <div className="bg-black/30 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Est. Revenue from Average</p>
                                        <p className="text-2xl font-black text-emerald-400"><span className="text-sm font-light text-slate-400 mr-1">LKR</span>{stats.averageRevenue.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="lg:col-span-2 bg-slate-900/40 p-6 rounded-3xl border border-white/5 shadow-xl flex flex-col">
                                    <h3 className="text-slate-300 font-bold text-sm tracking-widest uppercase mb-4 flex justify-between items-center">
                                        Subject Performance Breakdown
                                        <span className="bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full text-[10px]">{stats.subjectStats.length} Subjects</span>
                                    </h3>
                                    
                                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 max-h-[300px]">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr>
                                                    <th className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-3 border-b border-white/5">Subject Name</th>
                                                    <th className="text-[10px] font-bold text-blue-400 uppercase tracking-widest pb-3 border-b border-white/5 text-center">Total</th>
                                                    <th className="text-[10px] font-bold text-emerald-500/70 uppercase tracking-widest pb-3 border-b border-white/5 text-center">Full</th>
                                                    <th className="text-[10px] font-bold text-blue-500/70 uppercase tracking-widest pb-3 border-b border-white/5 text-center">Month</th>
                                                    <th className="text-[10px] font-bold text-orange-500/70 uppercase tracking-widest pb-3 border-b border-white/5 text-center">Inst.</th>
                                                    {/* 🔥 NEW COLUMNS: Free Card & Post Pay 🔥 */}
                                                    <th className="text-[10px] font-bold text-pink-500/70 uppercase tracking-widest pb-3 border-b border-white/5 text-center">Free</th>
                                                    <th className="text-[10px] font-bold text-orange-400/70 uppercase tracking-widest pb-3 border-b border-white/5 text-center">Post</th>
                                                    <th className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pb-3 border-b border-white/5 text-right">Rev (LKR)</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {stats.subjectStats.map((sub, i) => (
                                                    <tr key={i} className="hover:bg-white/5 transition-colors">
                                                        <td className="py-3 text-xs font-semibold text-slate-200 border-b border-white/5 truncate max-w-[120px]">{sub.name}</td>
                                                        <td className="py-3 text-sm font-black text-blue-300 text-center border-b border-white/5">{sub.enrolledCount}</td>
                                                        <td className="py-3 text-xs font-bold text-emerald-400 text-center border-b border-white/5">{sub.fullCount}</td>
                                                        <td className="py-3 text-xs font-bold text-blue-400 text-center border-b border-white/5">{sub.monthlyCount}</td>
                                                        <td className="py-3 text-xs font-bold text-orange-400 text-center border-b border-white/5">{sub.installCount}</td>
                                                        {/* 🔥 Display Free Card & Post Pay 🔥 */}
                                                        <td className="py-3 text-xs font-bold text-pink-400 text-center border-b border-white/5">{sub.freeCardCount}</td>
                                                        <td className="py-3 text-xs font-bold text-orange-300 text-center border-b border-white/5">{sub.postPayCount}</td>
                                                        <td className="py-3 text-xs font-bold text-emerald-400 text-right border-b border-white/5">{sub.revenue.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                                {stats.subjectStats.length === 0 && (
                                                    <tr>
                                                        <td colSpan="8" className="text-center py-10 text-slate-500 text-xs italic">No subject data found for selected filters.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                            </div>

                            <div className="text-center border-t border-white/5 pt-8">
                                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.5em]">Authorized Digital Report • IMA Campus CRM v2.0</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
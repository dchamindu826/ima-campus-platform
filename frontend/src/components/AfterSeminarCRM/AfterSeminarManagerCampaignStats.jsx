import React, { useState, useEffect, useMemo } from 'react';
import axios from '../../api/axios';
import { FaUsers, FaUserCheck, FaUserClock, FaBookOpen, FaChartBar, FaListAlt, FaSearch, FaTimes, FaFilter, FaMoneyBillWave, FaCheckCircle, FaExchangeAlt, FaUserTie, FaLayerGroup, FaChevronDown, FaExclamationTriangle, FaShieldAlt, FaExternalLinkAlt, FaFire, FaBolt, FaArrowRight } from 'react-icons/fa';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import toast from 'react-hot-toast';
import { Info, Target } from 'lucide-react';
import BusinessBadge from '../common/BusinessBadge';

import SubjectEnrollmentStats from "./CampaignStatsModules/SubjectEnrollmentStats"; 
import OpenSeminarControls from "./CampaignStatsModules/OpenSeminarControls";
import NewInquiriesPerformance from "./CampaignStatsModules/NewInquiriesPerformance";
import PaidCampaignPerformance from "./CampaignStatsModules/PaidCampaignPerformance";
import BridgeTransfersTab from "./CampaignStatsModules/BridgeTransfersTab";
import B2BLeadTransferHub from './B2BLeadTransferHub';
import CoordinatorProgressSheet from "./CampaignStatsModules/CoordinatorProgressSheet";
import MissingPaidStudentsModal from "./CampaignStatsModules/MissingPaidStudentsModal";

export default function AfterSeminarManagerCampaignStats({ filters = {}, allBatches, campaignType }) {
    // 🔥 උඩ තියෙන filters = {} කෑල්ල තමයි Error එක නැති කරන්නේ 🔥

    const loggedUser = JSON.parse(localStorage.getItem('user') || '{}') || {};
    const userRole = (loggedUser?.role || '').toUpperCase().replace(/ /g, '_');
    
    // Admin හෝ Manager ද කියලා බලනවා
    const isHigherManagement = ['SYSTEM_ADMIN', 'DIRECTOR', 'MANAGER', 'SUPER'].includes(userRole);

    const [loading, setLoading] = useState(true);
    
    const [stats, setStats] = useState({
        totalLeads: 0, assignedLeads: 0, unassignedLeads: 0,
        openSemLeads: 0, newInqLeads: 0, staffAllocation: [], 
        subjectEnrollments: [], mixerData: [],
        verifiedStudentsNotInCrm: [],
        openSemSummary: {},
        newInqSummary: {},
        staffBreakdown: [],
        staffBreakdownOpenSem: [],
        staffBreakdownNewInq: []
    });

    const [showMasterModal, setShowMasterModal] = useState(false);
    const [showMissingPaidModal, setShowMissingPaidModal] = useState(false);
    const [coordinatorFilter, setCoordinatorFilter] = useState('ALL'); // 'ALL' | 'OPEN_SEM' | 'NEW_INQ'
    const [masterLoading, setMasterLoading] = useState(false);
    const [masterLeads, setMasterLeads] = useState([]);
    const [masterSearch, setMasterSearch] = useState('');
    const [masterBatchFilter, setMasterBatchFilter] = useState('ALL');
    
    // Direct Signups (Not in CRM but verified payment) State
    const [directSignups, setDirectSignups] = useState([]);
    const [activeDirectoryTab, setActiveDirectoryTab] = useState('LEADS'); // 'LEADS' or 'DIRECT'

    const [leadsLimit, setLeadsLimit] = useState(50);
    const [directLimit, setDirectLimit] = useState(50);

    // Reset pagination limits back to 50 when search, batch filter or active tab changes
    useEffect(() => {
        setLeadsLimit(50);
        setDirectLimit(50);
    }, [masterSearch, masterBatchFilter, activeDirectoryTab]);

    // B2B Transfer States
    const [showTransferHub, setShowTransferHub] = useState(false);
    const [unreadTransfersCount, setUnreadTransfersCount] = useState(0);

    // Extract unique businesses for the transfer modal from allBatches
    const uniqueBusinesses = useMemo(() => {
        const bizMap = new Map();
        (allBatches || []).forEach(b => {
            if (b.business && !bizMap.has(b.business.id)) {
                bizMap.set(b.business.id, b.business);
            }
        });
        return Array.from(bizMap.values());
    }, [allBatches]);

    // Business එක මාරු වෙද්දි ඇත්තම Inbox එකේ ගාණ අරන් Button එක Blink කරනවා
    useEffect(() => {
        if (filters.selectedBusiness && isHigherManagement && campaignType === 'OVERALL') {
            const token = localStorage.getItem('token');
            axios.get('/after-seminar-crm/leads/b2b-history', { 
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: filters.selectedBusiness } 
            })
            .then(res => {
                const newInboxItems = res.data.inbox || [];
                setUnreadTransfersCount(newInboxItems.length);
            })
            .catch(() => {});
        }
    }, [filters.selectedBusiness, isHigherManagement, campaignType]);

    useEffect(() => {
        if ((filters.selectedBusiness || filters.selectedBatch) && isHigherManagement && campaignType === 'OVERALL') {
            fetchDashboardStats();
        } else {
            setLoading(false);
        }
    }, [filters.selectedBusiness, filters.selectedBatch, isHigherManagement, campaignType]);

    const fetchDashboardStats = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/manager-dashboard-stats', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: filters.selectedBusiness, batchId: filters.selectedBatch || 'ALL' }
            });
            if (res.data) {
                setStats({
                    ...res.data,
                    staffAllocation: res.data.staffAllocation || [],
                    subjectEnrollments: res.data.subjectEnrollments || [],
                    mixerData: res.data.mixerData || [],
                    verifiedStudentsNotInCrm: res.data.verifiedStudentsNotInCrm || []
                });
            }
        } catch (error) { 
            console.error("Failed to load manager stats", error); 
        } finally {
            setLoading(false);
        }
    };

    const fetchMasterDirectory = async () => {
        setMasterLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get('/after-seminar-crm/leads/master-directory', {
                headers: { Authorization: `Bearer ${token}` },
                params: { businessId: filters.selectedBusiness }
            });
            setMasterLeads(res.data.leads || []);
            setDirectSignups(res.data.verifiedStudentsNotInCrm || []);
        } catch (err) {
            toast.error("Failed to load Master Directory.");
            setMasterLeads([]); 
            setDirectSignups([]); 
        } finally {
            setMasterLoading(false);
        }
    };

    useEffect(() => {
        if (showMasterModal && isHigherManagement) {
            fetchMasterDirectory();
        }
    }, [showMasterModal]);

    const filteredMaster = useMemo(() => {
        const safeFiltered = (masterLeads || []).filter(l => {
            const matchSearch = l.phone.includes(masterSearch) || (l.name || '').toLowerCase().includes(masterSearch.toLowerCase());
            const matchBatch = masterBatchFilter === 'ALL' || String(l.batchId) === String(masterBatchFilter);
            return matchSearch && matchBatch;
        });

        // Deduplicate safeFiltered by student phone suffix (last 9 digits)
        const uniqueLeads = [];
        const seenPhones = new Set();
        
        safeFiltered.forEach(l => {
            if (!l.phone) return;
            const cleanPhone = l.phone.split('_')[0].replace(/[^0-9]/g, '');
            if (cleanPhone.length >= 9) {
                const key = cleanPhone.slice(-9);
                if (!seenPhones.has(key)) {
                    seenPhones.add(key);
                    uniqueLeads.push(l);
                }
            } else {
                uniqueLeads.push(l);
            }
        });
        
        return uniqueLeads;
    }, [masterLeads, masterSearch, masterBatchFilter]);

    const filteredDirectSignups = useMemo(() => {
        return (directSignups || []).filter(s => {
            const matchSearch = (s.phone || '').includes(masterSearch) || (s.name || '').toLowerCase().includes(masterSearch.toLowerCase());
            const matchBatch = masterBatchFilter === 'ALL' || String(s.batchId) === String(masterBatchFilter);
            return matchSearch && matchBatch;
        });
    }, [directSignups, masterSearch, masterBatchFilter]);

    const displayedLeads = useMemo(() => {
        return (filteredMaster || []).slice(0, leadsLimit);
    }, [filteredMaster, leadsLimit]);

    const displayedDirect = useMemo(() => {
        return (filteredDirectSignups || []).slice(0, directLimit);
    }, [filteredDirectSignups, directLimit]);

    const mStats = useMemo(() => {
        const safeFiltered = filteredMaster || [];
        const safeDirect = filteredDirectSignups || [];
        
        const enrolledLeadsCount = safeFiltered.filter(l => ((l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))))).length;
        const totalEnrolled = enrolledLeadsCount + safeDirect.length;

        const fullIntention = safeFiltered.filter(l => l.paymentIntention === 'FULL').length + safeDirect.filter(s => s.paymentIntention === 'FULL').length;
        const monthlyIntention = safeFiltered.filter(l => l.paymentIntention === 'MONTHLY').length + safeDirect.filter(s => s.paymentIntention === 'MONTHLY').length;
        const installmentIntention = safeFiltered.filter(l => l.paymentIntention === 'INSTALLMENT').length + safeDirect.filter(s => s.paymentIntention === 'INSTALLMENT').length;
        const notDecidedIntention = safeFiltered.filter(l => !l.paymentIntention || l.paymentIntention === 'NOT_DECIDED').length;

        return {
            total: safeFiltered.length + safeDirect.length,
            enrolled: totalEnrolled,
            nonEnrolled: safeFiltered.filter(l => (!(l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_'))))).length,
            directSignupsCount: safeDirect.length,
            full: fullIntention,
            monthly: monthlyIntention,
            installment: installmentIntention,
            notDecided: notDecidedIntention,
        };
    }, [filteredMaster, filteredDirectSignups]);

    const aggregatedRounds = useMemo(() => {
        const rounds = {
            '1': { assigned: 0, contacted: 0, answered: 0, noAnswer: 0, reject: 0, pending: 0, delayed: 0 },
            '2': { assigned: 0, contacted: 0, answered: 0, noAnswer: 0, reject: 0, pending: 0, delayed: 0 },
            'NON_ENROLLED': { assigned: 0, contacted: 0, answered: 0, noAnswer: 0, reject: 0, pending: 0, delayed: 0 },
            'PAID': { assigned: 0, contacted: 0, answered: 0, noAnswer: 0, reject: 0, pending: 0 }
        };
        
        let totalFull = 0, totalUpgrade = 0, totalMonthly = 0, totalInstallment = 0;

        if (stats.staffBreakdown) {
            stats.staffBreakdown.forEach(staff => {
                totalFull += (staff.overall?.full || 0);
                totalUpgrade += (staff.overall?.upgrade || 0);
                totalMonthly += (staff.overall?.monthly || 0);
                totalInstallment += (staff.overall?.installment || 0);

                ['1', '2', 'NON_ENROLLED', 'PAID'].forEach(round => {
                    if (staff.rounds && staff.rounds[round]) {
                        rounds[round].assigned += (staff.rounds[round].assigned || 0);
                        rounds[round].answered += (staff.rounds[round].answered || 0);
                        rounds[round].pending += (staff.rounds[round].pending || 0);
                        rounds[round].noAnswer += (staff.rounds[round].noAnswer || 0);
                        rounds[round].reject += (staff.rounds[round].reject || 0);
                        if (round === '1' || round === '2') {
                            rounds[round].delayed += (staff.rounds[round].delayed || 0);
                        }
                    }
                });
            });
        }
        
        return { rounds, totalFull, totalUpgrade, totalMonthly, totalInstallment };
    }, [stats.staffBreakdown]);

    const activeStaffList = useMemo(() => {
        if (coordinatorFilter === 'OPEN_SEM') return stats.staffBreakdownOpenSem || [];
        if (coordinatorFilter === 'NEW_INQ') return stats.staffBreakdownNewInq || [];
        return stats.staffBreakdown || [];
    }, [coordinatorFilter, stats]);

    const conversionRate = stats.assignedLeads > 0 ? Math.round((stats.totalEnrolled / stats.assignedLeads) * 100) : 0;

    const [expandedRows, setExpandedRows] = useState({});
    const toggleRow = (staffName) => {
        setExpandedRows(prev => ({ ...prev, [staffName]: !prev[staffName] }));
    };

    const openSemData = stats.openSemSummary || {};
    const newInqData = stats.newInqSummary || {};
    const missingPaidCount = (stats.verifiedStudentsNotInCrm || []).length;

    if (campaignType === 'OVERALL' && !isHigherManagement) {
        return <div className="p-10 text-center text-slate-500 font-bold">Access Denied. You do not have permission to view the Master Dashboard.</div>;
    }

    if (loading && campaignType === 'OVERALL') return <div className="flex justify-center items-center h-[200px] text-indigo-400 font-sans tracking-wide animate-pulse font-bold">Loading Master Workspace...</div>;

    return (
        <div className="w-full flex flex-col gap-6 font-sans antialiased text-slate-200 bg-transparent">
            
            {/* 🔥 1. OVERALL TAB (Campaign Overview - Master Stats Only) 🔥 */}
            {campaignType === 'OVERALL' && isHigherManagement && (
                <div className="space-y-6 animate-fade-in-up">
                    
                    {/* MASTER DIRECTORY & B2B TRANSFER & MISSING PAID ACTIONS */}
                    <div className="flex flex-col md:flex-row justify-between items-center bg-black/40 backdrop-blur-3xl p-5 rounded-3xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-1/4 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                        <div className="flex items-center gap-3 relative z-10">
                            <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl shadow-inner border border-indigo-500/30"><FaListAlt size={20}/></div>
                            <div>
                                <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                    Master Campaign Command Hub
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">Unified analytics and intelligent resolution for Open Seminar & New Inquiries</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 flex-wrap relative z-10">
                            {/* Missing Paid Web Students Quick Action Button */}
                            <button
                                onClick={() => setShowMissingPaidModal(true)}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center gap-2 cursor-pointer border ${
                                    missingPaidCount > 0 
                                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 shadow-amber-500/10 animate-pulse'
                                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                                }`}
                            >
                                <FaShieldAlt size={13} className={missingPaidCount > 0 ? "text-amber-400" : "text-emerald-400"} />
                                <span>Missing Paid Web</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                    missingPaidCount > 0 ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500/30 text-emerald-200'
                                }`}>
                                    {missingPaidCount}
                                </span>
                            </button>

                            <button 
                                onClick={() => setShowTransferHub(true)} 
                                className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer ${unreadTransfersCount > 0 ? 'bg-amber-600/90 hover:bg-amber-500 text-white animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/5'}`}
                            >
                                <FaExchangeAlt size={12}/> B2B Transfers {unreadTransfersCount > 0 && <span className="bg-amber-500 px-1.5 py-0.5 rounded text-[10px] ml-1 text-slate-950 font-black">{unreadTransfersCount} NEW</span>}
                            </button>
                            
                            <button 
                                onClick={() => setShowMasterModal(true)} 
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer shadow-indigo-600/20 hover:shadow-indigo-600/40"
                            >
                                <FaSearch size={12}/> Full Directory
                            </button>
                        </div>
                    </div>

                    {/* 🔥 2 PRO SPLIT OVERVIEW HERO CARDS (OPEN SEMINAR vs NEW INQUIRIES) 🔥 */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* 1. OPEN SEMINAR STATS CARD */}
                        <div className="bg-gradient-to-br from-indigo-950/40 via-black/40 to-slate-900/60 backdrop-blur-2xl p-6 rounded-[2.2rem] border border-blue-500/30 shadow-[0_8px_32px_rgba(30,58,138,0.25)] flex flex-col justify-between relative overflow-hidden group hover:border-blue-400/50 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-blue-500/15 transition-all"></div>
                            
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 shadow-inner">
                                        <FaLayerGroup size={18} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">Core Campaign</span>
                                        <h3 className="text-xl font-black text-white tracking-wide">Open Seminar Overview</h3>
                                    </div>
                                </div>
                                <div className="bg-blue-500/15 text-blue-300 border border-blue-500/30 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-inner flex items-center gap-1.5">
                                    <FaFire className="text-blue-400" size={11} />
                                    <span>{openSemData.conversionRate || 0}% Conversion</span>
                                </div>
                            </div>

                            {/* Primary High-Level Stat Grid */}
                            <div className="grid grid-cols-3 gap-3 mb-5 relative z-10">
                                <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1">Total Leads</span>
                                    <span className="text-2xl font-black text-slate-100">{openSemData.totalLeads || 0}</span>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[9px] uppercase font-bold text-blue-300 tracking-wider mb-1">Assigned Leads</span>
                                    <span className="text-2xl font-black text-blue-300">{openSemData.assignedLeads || 0}</span>
                                </div>
                                <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider mb-1 flex items-center gap-1">
                                        <FaCheckCircle size={9}/> Paid Enrolled
                                    </span>
                                    <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{openSemData.enrolled || 0}</span>
                                </div>
                            </div>

                            {/* Payment Plan Breakdown Sub-Grid */}
                            <div className="grid grid-cols-4 gap-2 mb-5 relative z-10 bg-black/30 p-3 rounded-2xl border border-white/5">
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Full</span>
                                    <span className="text-sm font-black text-emerald-400">{openSemData.full || 0}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Upgrade</span>
                                    <span className="text-sm font-black text-emerald-400">{openSemData.upgrade || 0}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Monthly</span>
                                    <span className="text-sm font-black text-emerald-400">{openSemData.monthly || 0}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Installment</span>
                                    <span className="text-sm font-black text-emerald-400">{openSemData.installment || 0}</span>
                                </div>
                            </div>

                            {/* Status Pills Mini Strip */}
                            <div className="grid grid-cols-5 gap-2 pt-4 border-t border-white/5 relative z-10 text-center">
                                <div className="bg-indigo-500/10 border border-indigo-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-indigo-300 block uppercase">Answered</span>
                                    <span className="text-xs font-black text-indigo-200">{openSemData.answered || 0}</span>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-amber-400 block uppercase">Pending</span>
                                    <span className="text-xs font-black text-amber-300">{openSemData.pending || 0}</span>
                                </div>
                                <div className="bg-slate-500/10 border border-slate-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-slate-400 block uppercase">No Ans</span>
                                    <span className="text-xs font-black text-slate-300">{openSemData.noAnswer || 0}</span>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-red-400 block uppercase">Reject</span>
                                    <span className="text-xs font-black text-red-300">{openSemData.reject || 0}</span>
                                </div>
                                <div className="bg-rose-500/10 border border-rose-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-rose-400 block uppercase">Delayed</span>
                                    <span className="text-xs font-black text-rose-300">{openSemData.delayed || 0}</span>
                                </div>
                            </div>

                            {/* Card Footer: Missing Paid Leads Resolver Button */}
                            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                                    <span className="text-slate-400 font-bold text-[11px]">Web Sync Status:</span>
                                    <span className="text-blue-300 font-black text-[11px]">{missingPaidCount} Unmatched</span>
                                </div>
                                <button
                                    onClick={() => setShowMissingPaidModal(true)}
                                    className="px-3.5 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>Resolve Leads</span>
                                    <FaArrowRight size={9} />
                                </button>
                            </div>
                        </div>

                        {/* 2. NEW INQUIRIES STATS CARD */}
                        <div className="bg-gradient-to-br from-purple-950/40 via-black/40 to-slate-900/60 backdrop-blur-2xl p-6 rounded-[2.2rem] border border-fuchsia-500/30 shadow-[0_8px_32px_rgba(168,85,247,0.25)] flex flex-col justify-between relative overflow-hidden group hover:border-fuchsia-400/50 transition-all duration-500">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-fuchsia-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-fuchsia-500/15 transition-all"></div>
                            
                            {/* Card Header */}
                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-fuchsia-500/20 text-fuchsia-400 rounded-2xl border border-fuchsia-500/30 shadow-inner">
                                        <FaBolt size={18} />
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-fuchsia-400 uppercase tracking-widest block">Inbound Feed</span>
                                        <h3 className="text-xl font-black text-white tracking-wide">New Inquiries Overview</h3>
                                    </div>
                                </div>
                                <div className="bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30 px-3.5 py-1.5 rounded-xl text-xs font-black shadow-inner flex items-center gap-1.5">
                                    <FaFire className="text-fuchsia-400" size={11} />
                                    <span>{newInqData.conversionRate || 0}% Conversion</span>
                                </div>
                            </div>

                            {/* Primary High-Level Stat Grid */}
                            <div className="grid grid-cols-3 gap-3 mb-5 relative z-10">
                                <div className="bg-black/40 border border-white/5 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1">Total Leads</span>
                                    <span className="text-2xl font-black text-slate-100">{newInqData.totalLeads || 0}</span>
                                </div>
                                <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[9px] uppercase font-bold text-fuchsia-300 tracking-wider mb-1">Assigned Leads</span>
                                    <span className="text-2xl font-black text-fuchsia-300">{newInqData.assignedLeads || 0}</span>
                                </div>
                                <div className="bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[9px] uppercase font-bold text-emerald-400 tracking-wider mb-1 flex items-center gap-1">
                                        <FaCheckCircle size={9}/> Paid Enrolled
                                    </span>
                                    <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{newInqData.enrolled || 0}</span>
                                </div>
                            </div>

                            {/* Payment Plan Breakdown Sub-Grid */}
                            <div className="grid grid-cols-4 gap-2 mb-5 relative z-10 bg-black/30 p-3 rounded-2xl border border-white/5">
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Full</span>
                                    <span className="text-sm font-black text-emerald-400">{newInqData.full || 0}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Upgrade</span>
                                    <span className="text-sm font-black text-emerald-400">{newInqData.upgrade || 0}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Monthly</span>
                                    <span className="text-sm font-black text-emerald-400">{newInqData.monthly || 0}</span>
                                </div>
                                <div className="text-center">
                                    <span className="text-[8px] uppercase font-bold text-slate-400 block">Installment</span>
                                    <span className="text-sm font-black text-emerald-400">{newInqData.installment || 0}</span>
                                </div>
                            </div>

                            {/* Status Pills Mini Strip */}
                            <div className="grid grid-cols-5 gap-2 pt-4 border-t border-white/5 relative z-10 text-center">
                                <div className="bg-indigo-500/10 border border-indigo-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-indigo-300 block uppercase">Answered</span>
                                    <span className="text-xs font-black text-indigo-200">{newInqData.answered || 0}</span>
                                </div>
                                <div className="bg-amber-500/10 border border-amber-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-amber-400 block uppercase">Pending</span>
                                    <span className="text-xs font-black text-amber-300">{newInqData.pending || 0}</span>
                                </div>
                                <div className="bg-slate-500/10 border border-slate-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-slate-400 block uppercase">No Ans</span>
                                    <span className="text-xs font-black text-slate-300">{newInqData.noAnswer || 0}</span>
                                </div>
                                <div className="bg-red-500/10 border border-red-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-red-400 block uppercase">Reject</span>
                                    <span className="text-xs font-black text-red-300">{newInqData.reject || 0}</span>
                                </div>
                                <div className="bg-rose-500/10 border border-rose-500/20 py-2 rounded-xl">
                                    <span className="text-[8px] font-bold text-rose-400 block uppercase">Delayed</span>
                                    <span className="text-xs font-black text-rose-300">{newInqData.delayed || 0}</span>
                                </div>
                            </div>

                            {/* Card Footer: Missing Paid Leads Resolver Button */}
                            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse"></span>
                                    <span className="text-slate-400 font-bold text-[11px]">Web Sync Status:</span>
                                    <span className="text-fuchsia-300 font-black text-[11px]">{missingPaidCount} Unmatched</span>
                                </div>
                                <button
                                    onClick={() => setShowMissingPaidModal(true)}
                                    className="px-3.5 py-1.5 bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/30 hover:border-fuchsia-500/50 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                    <span>Resolve Leads</span>
                                    <FaArrowRight size={9} />
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* 🔥 4 AGGREGATED CAMPAIGN ROUNDS STATUS CARDS 🔥 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {['1', '2', 'NON_ENROLLED', 'PAID'].map(round => {
                            const roundData = aggregatedRounds.rounds[round];
                            
                            let title = `ROUND 0${round}`;
                            let iconColor = 'text-indigo-400';
                            let bgGradient = 'from-indigo-500/10 to-transparent';
                            let borderColor = 'border-indigo-500/20';
                            let answerColor = 'text-indigo-300';
                            let answerBg = 'bg-indigo-500/10 border-indigo-500/20';

                            if (round === 'NON_ENROLLED') {
                                title = 'NON ENROLLED';
                                iconColor = 'text-slate-400';
                                bgGradient = 'from-slate-600/10 to-transparent';
                                borderColor = 'border-slate-500/20';
                                answerColor = 'text-slate-300';
                                answerBg = 'bg-slate-500/10 border-slate-500/20';
                            } else if (round === 'PAID') {
                                title = 'ENROLLED (PAID)';
                                iconColor = 'text-emerald-400';
                                bgGradient = 'from-emerald-500/10 to-transparent';
                                borderColor = 'border-emerald-500/20';
                                answerColor = 'text-emerald-300';
                                answerBg = 'bg-emerald-500/10 border-emerald-500/20';
                            } else if (round === '2') {
                                iconColor = 'text-blue-400';
                                bgGradient = 'from-blue-500/10 to-transparent';
                                borderColor = 'border-blue-500/20';
                                answerColor = 'text-blue-300';
                                answerBg = 'bg-blue-500/10 border-blue-500/20';
                            }

                            return (
                                <div key={round} className={`bg-gradient-to-br ${bgGradient} border ${borderColor} rounded-[2rem] p-5 flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group relative overflow-hidden bg-black/20 backdrop-blur-md`}>
                                    <div className={`absolute top-0 right-0 w-32 h-32 bg-current opacity-[0.03] rounded-bl-full pointer-events-none ${iconColor}`}></div>
                                    
                                    <div className="flex justify-between items-center border-b border-white/5 pb-4 mb-4 relative z-10">
                                        <span className={`text-xs font-black uppercase tracking-widest ${iconColor} drop-shadow-sm flex items-center gap-2`}>
                                            {title}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-3 relative z-10">
                                        {round === 'PAID' ? (
                                            <div className="grid grid-cols-2 gap-3 mt-1">
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                    <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Full</span>
                                                    <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{aggregatedRounds.totalFull}</span>
                                                </div>
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                    <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Upgrade</span>
                                                    <span className="text-xl font-black text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]">{aggregatedRounds.totalUpgrade}</span>
                                                </div>
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                    <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Monthly</span>
                                                    <span className="text-xl font-black text-emerald-400">{aggregatedRounds.totalMonthly}</span>
                                                </div>
                                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl flex flex-col justify-center items-center shadow-inner">
                                                    <span className="text-[10px] text-emerald-500/70 font-bold uppercase tracking-wider mb-1">Installment</span>
                                                    <span className="text-xl font-black text-emerald-400">{aggregatedRounds.totalInstallment}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-black/30 border border-white/5 p-3 rounded-xl flex flex-col justify-center items-center">
                                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Assigned</span>
                                                        <span className="text-xl font-black text-slate-200">{roundData.assigned}</span>
                                                    </div>
                                                    <div className={`${answerBg} border p-3 rounded-xl flex flex-col justify-center items-center relative overflow-hidden`}>
                                                        <span className={`text-[10px] ${iconColor} opacity-80 font-bold uppercase tracking-wider mb-1`}>Answered</span>
                                                        <span className={`text-xl font-black ${answerColor}`}>{roundData.answered}</span>
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-3 gap-2">
                                                    <div className="bg-amber-500/5 border border-amber-500/10 p-2.5 rounded-xl flex flex-col justify-center items-center">
                                                        <span className="text-[9px] text-amber-500/70 font-bold uppercase tracking-wider mb-1">Pending</span>
                                                        <span className="text-sm font-bold text-amber-400">{roundData.pending}</span>
                                                    </div>
                                                    <div className="bg-slate-500/10 border border-slate-500/10 p-2.5 rounded-xl flex flex-col justify-center items-center">
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mb-1">No Ans</span>
                                                        <span className="text-sm font-bold text-slate-300">{roundData.noAnswer}</span>
                                                    </div>
                                                    <div className="bg-red-500/5 border border-red-500/10 p-2.5 rounded-xl flex flex-col justify-center items-center">
                                                        <span className="text-[9px] text-red-400/70 font-bold uppercase tracking-wider mb-1">Reject</span>
                                                        <span className="text-sm font-bold text-red-400">{roundData.reject}</span>
                                                    </div>
                                                </div>
                                                
                                                {/* Extras: Delayed (Only for R1 & R2) */}
                                                {(round === '1' || round === '2') && (
                                                    <div className="flex justify-between items-center text-xs mt-2 px-1">
                                                        {roundData.delayed > 0 ? (
                                                            <>
                                                                <span className="text-rose-400/80 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5"><FaExclamationTriangle size={10}/> Delayed KPI</span>
                                                                <span className="text-rose-400 font-black bg-rose-500/10 px-2.5 py-0.5 rounded text-xs border border-rose-500/20">{roundData.delayed}</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-slate-600 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1">No Delays</span>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 🔥 3. COORDINATOR PERFORMANCE WITH 3-WAY FILTER SWITCHER 🔥 */}
                    <div className="w-full mt-8">
                        <div className="bg-black/40 backdrop-blur-3xl p-6 md:p-8 rounded-[2.5rem] border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.3)] flex flex-col relative overflow-hidden group">
                            
                            {/* Section Header & Filter Switcher */}
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10 border-b border-white/5 pb-5">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-200 uppercase tracking-widest flex items-center gap-3">
                                        <div className="p-2 bg-indigo-500/20 rounded-xl shadow-inner border border-indigo-500/20"><FaUserTie className="text-indigo-400"/></div>
                                        Coordinator Performance Breakdown
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1">Individual caller metrics, conversion ratios, and round status</p>
                                </div>

                                {/* 3-Way Segmented Filter Switcher */}
                                <div className="flex items-center gap-1.5 p-1.5 bg-black/60 backdrop-blur-md rounded-2xl border border-white/10 shadow-inner">
                                    <button
                                        onClick={() => setCoordinatorFilter('ALL')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                                            coordinatorFilter === 'ALL'
                                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                    >
                                        <span>All Combined</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{stats.staffBreakdown?.length || 0}</span>
                                    </button>

                                    <button
                                        onClick={() => setCoordinatorFilter('OPEN_SEM')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                                            coordinatorFilter === 'OPEN_SEM'
                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                    >
                                        <span>Open Seminar</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{stats.staffBreakdownOpenSem?.length || 0}</span>
                                    </button>

                                    <button
                                        onClick={() => setCoordinatorFilter('NEW_INQ')}
                                        className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer flex items-center gap-1.5 ${
                                            coordinatorFilter === 'NEW_INQ'
                                                ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30'
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                        }`}
                                    >
                                        <span>New Inquiries</span>
                                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10">{stats.staffBreakdownNewInq?.length || 0}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Coordinator Cards List */}
                            <div className="flex-1">
                                {(!activeStaffList || activeStaffList.length === 0) ? (
                                    <div className="text-center py-12 text-slate-500 text-sm font-bold bg-white/[0.02] rounded-2xl border border-white/5">
                                        No coordinator activity recorded for the selected campaign view.
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {activeStaffList.map((staff, idx) => {
                                            const isExpanded = expandedRows[staff.name];
                                            const rate = staff.overall.assigned > 0 ? Math.round((staff.overall.enrolled / staff.overall.assigned) * 100) : 0;
                                            const isHighDelay = staff.overall.delayed > 10;

                                            return (
                                                <div key={idx} className={`bg-black/40 backdrop-blur-3xl rounded-[2rem] border transition-all duration-500 overflow-hidden ${isExpanded ? 'border-indigo-500/30 shadow-[0_8px_32px_rgba(99,102,241,0.15)]' : 'border-white/10 shadow-xl hover:border-white/20'}`}>
                                                    
                                                    {/* Header Row / Main Overview */}
                                                    <div onClick={() => toggleRow(staff.name)} className={`p-5 cursor-pointer flex flex-col xl:flex-row items-center justify-between gap-6 transition-colors ${isExpanded ? 'bg-indigo-500/5' : 'hover:bg-white/5'}`}>
                                                        
                                                        {/* Coordinator Name & Badge */}
                                                        <div className="flex items-center gap-4 w-full xl:w-1/4">
                                                            <div className={`p-2.5 rounded-xl flex-shrink-0 transition-all duration-300 ${isExpanded ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)] rotate-180' : 'bg-white/5 text-slate-400'}`}>
                                                                <FaChevronDown size={14} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-lg text-white tracking-wide">{staff.name}</span>
                                                                <div className="mt-1 flex"><BusinessBadge businessType={staff.businessType} role={staff.role} /></div>
                                                            </div>
                                                        </div>

                                                        {/* Main Stats Grid */}
                                                        <div className="grid grid-cols-4 md:grid-cols-7 gap-4 w-full xl:w-3/4 flex-1 items-center">
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] uppercase font-bold text-slate-500 mb-1 tracking-widest">Assigned</span>
                                                                <span className="text-xl font-black text-slate-300">{staff.overall.assigned}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center relative group">
                                                                <span className="text-[9px] uppercase font-bold text-indigo-400 mb-1 tracking-widest group-hover:text-indigo-300 transition-colors">Answered</span>
                                                                <span className="text-2xl font-black text-indigo-300 drop-shadow-[0_0_12px_rgba(99,102,241,0.5)]">{staff.overall.answered}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] uppercase font-bold text-slate-400 mb-1 tracking-widest">No Ans</span>
                                                                <span className="text-lg font-black text-slate-300">{staff.overall.noAnswer}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] uppercase font-bold text-amber-500 mb-1 tracking-widest">Pending</span>
                                                                <span className="text-lg font-black text-amber-400">{staff.overall.pending}</span>
                                                            </div>
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[9px] uppercase font-bold text-red-400/80 mb-1 tracking-widest">Reject</span>
                                                                <span className="text-lg font-black text-red-400">{staff.overall.reject}</span>
                                                            </div>
                                                            
                                                            <div className="flex flex-col items-center md:border-l border-white/5 pl-4">
                                                                <span className="text-[9px] uppercase font-bold text-emerald-500/70 mb-1 tracking-widest flex items-center gap-1"><FaCheckCircle size={8}/> Enrolled</span>
                                                                <div className="flex items-end gap-1.5">
                                                                    <span className="text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">{staff.overall.enrolled}</span>
                                                                    <span className="text-[10px] text-emerald-500 font-bold mb-1">({rate}%)</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-center md:border-l border-white/5 pl-4 relative">
                                                                {isHighDelay && <div className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full animate-ping"></div>}
                                                                <span className={`text-[9px] uppercase font-bold mb-1 tracking-widest ${isHighDelay ? 'text-rose-400' : 'text-slate-500'}`}>Delayed</span>
                                                                <span className={`text-xl font-black ${isHighDelay ? 'text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'text-slate-400'}`}>{staff.overall.delayed}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Expanded Content (Round Breakdown) */}
                                                    <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                                        <div className="overflow-hidden">
                                                            <div className="p-6 pt-0 border-t border-white/5 bg-black/20">
                                                                <div className="mt-6">
                                                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                                        <FaLayerGroup /> Round Breakdown ({coordinatorFilter === 'OPEN_SEM' ? 'Open Seminar' : coordinatorFilter === 'NEW_INQ' ? 'New Inquiries' : 'Combined Master'})
                                                                    </h4>
                                                                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                                                                        {['1', '2', 'NON_ENROLLED', 'PAID'].map(rKey => {
                                                                            const rData = staff.rounds[rKey];
                                                                            if (!rData) return null;

                                                                            let rTitle = `Round ${rKey}`;
                                                                            let rColor = 'text-indigo-400';
                                                                            let rBg = 'bg-indigo-500/10 border-indigo-500/20';

                                                                            if (rKey === 'NON_ENROLLED') {
                                                                                rTitle = 'Non Enrolled';
                                                                                rColor = 'text-slate-400';
                                                                                rBg = 'bg-slate-500/10 border-slate-500/20';
                                                                            } else if (rKey === 'PAID') {
                                                                                rTitle = 'Enrolled (Paid)';
                                                                                rColor = 'text-emerald-400';
                                                                                rBg = 'bg-emerald-500/10 border-emerald-500/20';
                                                                            } else if (rKey === '2') {
                                                                                rColor = 'text-blue-400';
                                                                                rBg = 'bg-blue-500/10 border-blue-500/20';
                                                                            }

                                                                            return (
                                                                                <div key={rKey} className={`${rBg} border rounded-2xl p-4 flex flex-col justify-between`}>
                                                                                    <div className="flex justify-between items-center mb-3">
                                                                                        <span className={`text-[10px] font-black uppercase tracking-wider ${rColor}`}>{rTitle}</span>
                                                                                        <span className="text-[10px] font-bold text-slate-300 bg-black/30 px-2 py-0.5 rounded-md">Assigned: {rData.assigned}</span>
                                                                                    </div>
                                                                                    {rKey === 'PAID' ? (
                                                                                        <div className="grid grid-cols-2 gap-2 mt-auto">
                                                                                            <div className="flex flex-col"><span className="text-[8px] text-emerald-500/70 uppercase font-bold">Full</span><span className="text-sm font-black text-emerald-400">{staff.overall.full}</span></div>
                                                                                            <div className="flex flex-col"><span className="text-[8px] text-emerald-500/70 uppercase font-bold">Monthly</span><span className="text-sm font-black text-emerald-400">{staff.overall.monthly}</span></div>
                                                                                            <div className="flex flex-col"><span className="text-[8px] text-emerald-500/70 uppercase font-bold">Install</span><span className="text-sm font-black text-emerald-400">{staff.overall.installment}</span></div>
                                                                                            <div className="flex flex-col"><span className="text-[8px] text-emerald-500/70 uppercase font-bold">Upgrade</span><span className="text-sm font-black text-emerald-400">{staff.overall.upgrade}</span></div>
                                                                                        </div>
                                                                                    ) : (
                                                                                        <div className="grid grid-cols-3 gap-2 mt-auto">
                                                                                            <div className="flex flex-col"><span className={`text-[8px] opacity-70 uppercase font-bold ${rColor}`}>Ans</span><span className={`text-sm font-black ${rColor}`}>{rData.answered}</span></div>
                                                                                            <div className="flex flex-col"><span className="text-[8px] text-slate-500 uppercase font-bold">No Ans</span><span className="text-sm font-black text-slate-300">{rData.noAnswer}</span></div>
                                                                                            <div className="flex flex-col"><span className="text-[8px] text-amber-500/70 uppercase font-bold">Pend</span><span className="text-sm font-black text-amber-400">{rData.pending}</span></div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 🔥 4. SUBJECT ENROLLMENT STATS 🔥 */}
                    <SubjectEnrollmentStats rawSubjects={stats.subjectEnrollments || []} mixerData={stats.mixerData || []} />

                    {/* 🔥 5. DIRECT SIGNUPS LIST (NOT IN CRM) 🔥 */}
                    {stats.verifiedStudentsNotInCrm && stats.verifiedStudentsNotInCrm.length > 0 && (
                        <div className="bg-white/[0.02] backdrop-blur-md p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                                        <FaUsers size={16} /> Verified Direct Signups (Not in CRM)
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-1 font-medium">
                                        Students with approved payments who registered directly and do not exist as CRM leads.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-4 py-2 rounded-xl text-xs font-black shadow-inner">
                                        {stats.verifiedStudentsNotInCrm.length} Students
                                    </span>
                                    <button
                                        onClick={() => setShowMissingPaidModal(true)}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                                    >
                                        <FaShieldAlt size={12}/> Resolve All
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                {stats.verifiedStudentsNotInCrm.map((s, i) => (
                                    <div key={i} className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all flex justify-between items-center gap-3">
                                        <div>
                                            <h4 className="text-white font-bold text-sm tracking-wide">{s.phone}</h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-widest">{s.name || 'Unknown'}</p>
                                            <p className="text-[9px] text-slate-500 mt-1 uppercase font-semibold tracking-wider">Batch: {s.batchName || 'N/A'}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[10px] font-black shadow-sm">
                                                LKR {s.amountPaid?.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>
            )}

            {/* 🔥 2. RENDER SPECIFIC CAMPAIGN STATS 🔥 */}
            {campaignType === 'OPEN_SEM' && <div className="animate-fade-in-up"><OpenSeminarControls filters={filters} allBatches={allBatches} isManager={true} /></div>}
            {campaignType === 'NEW_INQ' && <div className="animate-fade-in-up"><NewInquiriesPerformance filters={filters} allBatches={allBatches} isManager={true} /></div>}
            {campaignType === 'BRIDGE' && <div className="animate-fade-in-up"><BridgeTransfersTab filters={filters} allBatches={allBatches} /></div>}
            {campaignType === 'PAID' && <div className="animate-fade-in-up"><PaidCampaignPerformance filters={filters} /></div>}
            {(campaignType === 'COORD_PROGRESS' || campaignType === 'COORD_TRACKING') && <div className="animate-fade-in-up"><CoordinatorProgressSheet filters={filters} /></div>}

            {/* 🔥 FULL SCREEN MODAL: MASTER LEAD DIRECTORY (ONLY FOR OVERALL) 🔥 */}
            {showMasterModal && isHigherManagement && (
                <div className="fixed inset-0 z-[200] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4 pl-[260px] lg:pl-[280px] xl:pl-[300px] w-full h-full animate-fade-in">
                    <div className="bg-slate-900/90 backdrop-blur-2xl w-full h-full rounded-3xl flex flex-col overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.6)] relative">
                        <div className="bg-white/5 backdrop-blur-md px-6 py-5 flex justify-between items-center border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-xl"><FaListAlt size={22}/></div>
                                <div>
                                    <h3 className="text-white font-black text-xl tracking-wide">Campaign Master Directory</h3>
                                    <p className="text-slate-400 text-xs mt-1 font-medium">Comprehensive view of all inquiries, direct signups, and enrollment statistics</p>
                                </div>
                            </div>
                            <button onClick={() => setShowMasterModal(false)} className="bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white p-3 rounded-xl transition-all shadow-sm">
                                <FaTimes size={18} />
                            </button>
                        </div>

                        {masterLoading ? (
                            <div className="flex-1 flex justify-center items-center text-indigo-400 animate-pulse font-bold text-xl">Fetching Global Directory...</div>
                        ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-transparent">
                                
                                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
                                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 xl:col-span-3">
                                        <div className="bg-white/[0.03] p-5 rounded-3xl border border-white/10 flex flex-col justify-center shadow-lg hover:border-indigo-500/30 transition-all">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Students</p>
                                            <h2 className="text-3xl font-black text-white mt-1">{mStats.total || 0}</h2>
                                        </div>
                                        <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-all">
                                                <Target size={64} className="text-emerald-500" />
                                            </div>
                                            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest font-black flex items-center gap-2">
                                                Total Enrolled
                                                <span title="Total Unique Students who have an APPROVED payment in this batch (Excludes free cards)." className="cursor-help opacity-70 hover:opacity-100 text-slate-400"><Info size={14} /></span>
                                            </p>
                                            <h2 className="text-3xl font-black text-emerald-400 mt-1">{mStats.enrolled || 0}</h2>
                                        </div>
                                        <div className="bg-indigo-500/10 p-5 rounded-3xl border border-indigo-500/20 flex flex-col justify-center shadow-lg hover:bg-indigo-500/15 transition-all">
                                            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest font-black">Direct Signups</p>
                                            <h2 className="text-3xl font-black text-indigo-400 mt-1">{mStats.directSignupsCount || 0}</h2>
                                        </div>
                                        <div className="bg-rose-500/10 p-5 rounded-3xl border border-rose-500/20 flex flex-col justify-center shadow-lg hover:bg-rose-500/15 transition-all">
                                            <p className="text-[10px] text-rose-400 font-bold uppercase tracking-widest">Non-Enrolled</p>
                                            <h2 className="text-3xl font-black text-rose-400 mt-1">{mStats.nonEnrolled || 0}</h2>
                                        </div>
                                        <div className="bg-amber-500/10 p-5 rounded-3xl border border-amber-500/20 flex flex-col justify-center shadow-lg hover:bg-amber-500/15 transition-all col-span-2 md:col-span-1">
                                            <p className="text-[10px] text-amber-400 font-bold uppercase tracking-widest">Conversion</p>
                                            <h2 className="text-3xl font-black text-amber-400 mt-1">
                                                {mStats.total > 0 ? Math.round((mStats.enrolled / mStats.total) * 100) : 0}%
                                            </h2>
                                        </div>
                                    </div>
                                </div>

                                {/* Tab Capsule Toggle */}
                                <div className="flex gap-2 p-1.5 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 w-max mb-6">
                                    <button 
                                        onClick={() => setActiveDirectoryTab('LEADS')}
                                        className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeDirectoryTab === 'LEADS' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Campaign Leads ({filteredMaster.length})
                                    </button>
                                    <button 
                                        onClick={() => setActiveDirectoryTab('DIRECT')}
                                        className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${activeDirectoryTab === 'DIRECT' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Direct Signups ({filteredDirectSignups.length})
                                    </button>
                                </div>

                                {/* Filters for Modal */}
                                <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white/[0.02] backdrop-blur-md p-5 rounded-3xl border border-white/10 mb-6 shadow-md">
                                    <div className="flex items-center gap-3 w-full md:w-auto">
                                        <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-slate-400"><FaFilter size={16} /></div>
                                        <select 
                                            value={masterBatchFilter} 
                                            onChange={(e) => setMasterBatchFilter(e.target.value)} 
                                            className="bg-slate-900 border border-white/10 text-white text-xs font-bold rounded-xl px-5 py-3 outline-none focus:border-indigo-500 cursor-pointer shadow-inner"
                                        >
                                            <option value="ALL">All Batches</option>
                                            <option value="UNASSIGNED">No Batch Assigned</option>
                                            {(allBatches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="relative w-full md:w-96">
                                        <FaSearch className="absolute left-4 top-3.5 text-slate-400 text-sm" />
                                        <input 
                                            type="text" 
                                            placeholder="Search by Name or Phone..." 
                                            value={masterSearch} 
                                            onChange={(e) => setMasterSearch(e.target.value)} 
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white outline-none focus:border-indigo-500 transition-all shadow-inner placeholder-slate-500" 
                                        />
                                    </div>
                                </div>

                                {/* Data Table */}
                                <div className="bg-white/[0.02] backdrop-blur-md rounded-3xl border border-white/10 overflow-hidden shadow-xl">
                                    <div className="overflow-x-auto max-h-[500px] custom-scrollbar">
                                        {activeDirectoryTab === 'LEADS' ? (
                                            <>
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-white/[0.04] text-slate-300 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-md border-b border-white/10">
                                                        <tr>
                                                            <th className="py-5 px-6 font-black">Student Details</th>
                                                            <th className="py-5 px-6 font-black text-center">Inquiry Source</th>
                                                            <th className="py-5 px-6 font-black text-center text-blue-400">Marked Intention</th>
                                                            <th className="py-5 px-6 font-black text-center text-emerald-400">Actual Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {(!displayedLeads || displayedLeads.length === 0) ? (
                                                            <tr><td colSpan="4" className="text-center py-16 text-slate-500 font-bold text-base">No leads match your search criteria.</td></tr>
                                                        ) : (
                                                            displayedLeads.map((l, i) => (
                                                                <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                                                                    <td className="py-4 px-6">
                                                                        <h4 className="text-slate-100 font-black text-base tracking-wide">{l.phone}</h4>
                                                                        <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{l.name || 'Unknown'}</p>
                                                                    </td>
                                                                    <td className="py-4 px-6 text-center">
                                                                        <span className="bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase border border-slate-700 shadow-sm">
                                                                            {l.inquiryType?.replace('_', ' ') || 'UNKNOWN'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-4 px-6 text-center">
                                                                        <span className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm ${l.paymentIntention === 'FULL' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : l.paymentIntention === 'MONTHLY' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : l.paymentIntention === 'INSTALLMENT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-900 text-slate-400 border-white/5'}`}>
                                                                            {l.paymentIntention || 'NOT DECIDED'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-4 px-6 text-center">
                                                                        {((l.enrollmentStatus === 'ENROLLED' || l.enrollmentStatus === 'PAID' || (l.enrollmentStatus && l.enrollmentStatus.startsWith('ENROLLED_')))) ? (
                                                                            <span className="text-emerald-400 font-black text-xs flex items-center justify-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-lg w-max mx-auto shadow-sm"><FaCheckCircle/> ENROLLED</span>
                                                                        ) : (
                                                                            <span className="text-rose-400 font-black text-[10px] uppercase tracking-widest bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-lg w-max mx-auto shadow-sm">Non-Enrolled</span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                                {filteredMaster.length > leadsLimit && (
                                                    <div className="p-4 flex justify-center border-t border-white/5 bg-slate-950/80 sticky bottom-0 z-20 backdrop-blur-md">
                                                        <button 
                                                            onClick={() => setLeadsLimit(prev => prev + 50)}
                                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider py-2.5 px-6 rounded-xl transition-all shadow-md hover:scale-[1.02]"
                                                        >
                                                            Load More (Showing {leadsLimit} of {filteredMaster.length})
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <table className="w-full text-left text-sm whitespace-nowrap">
                                                    <thead className="bg-white/[0.04] text-slate-300 text-[10px] uppercase tracking-widest sticky top-0 z-10 shadow-md border-b border-white/10">
                                                        <tr>
                                                            <th className="py-5 px-6 font-black">Student Details</th>
                                                            <th className="py-5 px-6 font-black text-center">Registered Batch</th>
                                                            <th className="py-5 px-6 font-black text-center text-blue-400">Payment Intention</th>
                                                            <th className="py-5 px-6 font-black text-center text-emerald-400">Paid Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-white/5">
                                                        {(!displayedDirect || displayedDirect.length === 0) ? (
                                                            <tr><td colSpan="4" className="text-center py-16 text-slate-500 font-bold text-base">No direct signups match your search criteria.</td></tr>
                                                        ) : (
                                                            displayedDirect.map((s, i) => (
                                                                <tr key={i} className="hover:bg-white/[0.03] transition-colors">
                                                                    <td className="py-4 px-6">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                                                                                STU-{s.studentId}
                                                                            </span>
                                                                            <h4 className="text-slate-100 font-black text-base tracking-wide">{s.phone}</h4>
                                                                        </div>
                                                                        <p className="text-[11px] font-bold text-slate-500 mt-1 uppercase tracking-widest">{s.name || 'Unknown'}</p>
                                                                    </td>
                                                                    <td className="py-4 px-6 text-center">
                                                                        <span className="bg-slate-800 text-slate-300 px-4 py-2 rounded-lg text-[10px] font-black tracking-widest uppercase border border-slate-700 shadow-sm">
                                                                            {s.batchName || 'N/A'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-4 px-6 text-center">
                                                                        <span className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border shadow-sm ${s.paymentIntention === 'FULL' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : s.paymentIntention === 'MONTHLY' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : s.paymentIntention === 'INSTALLMENT' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-slate-900 text-slate-400 border-white/5'}`}>
                                                                            {s.paymentIntention || 'MONTHLY'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-4 px-6 text-center">
                                                                        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-lg text-xs font-black shadow-sm inline-flex items-center gap-1.5">
                                                                            LKR {s.amountPaid?.toLocaleString()}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                                {filteredDirectSignups.length > directLimit && (
                                                    <div className="p-4 flex justify-center border-t border-white/5 bg-slate-950/80 sticky bottom-0 z-20 backdrop-blur-md">
                                                        <button 
                                                            onClick={() => setDirectLimit(prev => prev + 50)}
                                                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider py-2.5 px-6 rounded-xl transition-all shadow-md hover:scale-[1.02]"
                                                        >
                                                            Load More (Showing {directLimit} of {filteredDirectSignups.length})
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 🔥 MISSING PAID WEB STUDENTS MODAL 🔥 */}
            <MissingPaidStudentsModal
                isOpen={showMissingPaidModal}
                onClose={() => setShowMissingPaidModal(false)}
                businessId={filters.selectedBusiness}
                batchId={filters.selectedBatch}
                onStudentPushed={fetchDashboardStats}
            />

            {/* 🔥 B2B LEAD TRANSFER MODAL 🔥 */}
            <B2BLeadTransferHub 
                isOpen={showTransferHub} 
                onClose={() => setShowTransferHub(false)} 
                currentBusinessId={filters.selectedBusiness} // Error Fixed
            />

        </div>
    );
}
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Search, Edit3, KeyRound, LogIn, MessageSquare, Loader2, X, CheckCircle, Database, ChevronLeft, ChevronRight, ChevronDown, MonitorPlay, Palette, Trash2, BarChart3, FileText, Download, Sparkles } from 'lucide-react';
import axios from '../../api/axios';
import toast from 'react-hot-toast';
import { resolveAvatarUrl } from '../../utils/avatarUtils';

export default function StudentDataCenter({ loggedInUser }) {
    const navigate = useNavigate();
    const userRole = loggedInUser?.role ? String(loggedInUser.role).toUpperCase().replace(/[\s_-]+/g, '_') : '';
    const isAdmin = ['SYSTEM_ADMIN', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN'].includes(userRole);
    const isManager = ['MANAGER', 'ASS_MANAGER', 'SUPER', 'HEAD_MANAGER'].includes(userRole) || userRole.includes('MANAGER');
    const isCoordinator = ['COORDINATOR', 'CLASS_COORDINATOR', 'CALLER'].includes(userRole) || userRole.includes('COORDINATOR');
    const canManageStudents = isAdmin || isManager || isCoordinator;
    const canDeleteStudents = isAdmin || isManager || isCoordinator;
    
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [availableBatches, setAvailableBatches] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [filterBusinessId, setFilterBusinessId] = useState('All');
    const [filterBatch, setFilterBatch] = useState('All');
    const [filterPaymentGroups, setFilterPaymentGroups] = useState([]);
    const [filterSubjects, setFilterSubjects] = useState([]);

    const [isSubjectsDropdownOpen, setIsSubjectsDropdownOpen] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const [availableSubjects, setAvailableSubjects] = useState([]);
    const [availablePaymentGroups, setAvailablePaymentGroups] = useState([]);

    const [editModal, setEditModal] = useState(null);
    const [passwordModal, setPasswordModal] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastResetPassword, setLastResetPassword] = useState(null); 

    const [ghostIframe, setGhostIframe] = useState(null);
    const [originalAdminSession, setOriginalAdminSession] = useState(null);

    // 🔥 NEW ANALYTICS REPORT STATES 🔥
    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
    const [analyticsBizFilter, setAnalyticsBizFilter] = useState('All');
    const [analyticsBatchFilter, setAnalyticsBatchFilter] = useState('All');
    const [analyticsAvailableBatches, setAnalyticsAvailableBatches] = useState([]);
    const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
    const [analyticsActiveAgeFilter, setAnalyticsActiveAgeFilter] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get('/admin/students-data-center');
            setStudents(res.data || []);
            if (canManageStudents) {
                const bizRes = await axios.get('/admin/businesses');
                setBusinesses(bizRes.data?.businesses || bizRes.data || []);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to load students data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [canManageStudents]);

    useEffect(() => {
        if (filterBusinessId === 'All') {
            const uniqueBatches = new Set();
            students.forEach(s => {
                (s.enrolledBatches || []).forEach(b => uniqueBatches.add(b));
            });
            setAvailableBatches([...uniqueBatches]);
        } else {
            axios.get(`/admin/batches/${filterBusinessId}`)
                .then(res => {
                    const bData = res.data.batches || res.data || [];
                    setAvailableBatches(bData.map(b => b.name));
                }).catch(err => console.error(err));
        }
    }, [filterBusinessId, students]);

    useEffect(() => {
        const uniqueSubjects = new Set();
        const uniqueGroupsMap = new Map();

        students.forEach(s => {
            let matchesBiz = true;
            if (filterBusinessId !== 'All') {
                const selectedBiz = businesses.find(b => b.id.toString() === filterBusinessId);
                if (selectedBiz) matchesBiz = (s.enrolledBusinesses || []).includes(selectedBiz.name);
            }
            let matchesBatch = true;
            if (filterBatch !== 'All') matchesBatch = (s.enrolledBatches || []).includes(filterBatch);
            
            if (matchesBiz && matchesBatch) {
                (s.enrolledSubjects || []).forEach(sub => uniqueSubjects.add(sub));
                
                (s.enrolledGroups || []).forEach(g => {
                    if (filterBatch === 'All' || g.batchName === filterBatch) {
                        uniqueGroupsMap.set(g.id, g.name);
                    }
                });
            }
        });
        
        setAvailableSubjects([...uniqueSubjects]);
        setAvailablePaymentGroups(Array.from(uniqueGroupsMap.entries()).map(([id, name]) => ({ id, name })));
        
        setFilterSubjects([]);
        setFilterPaymentGroups([]);
    }, [filterBusinessId, filterBatch, students, businesses]);

    useEffect(() => {
        if (analyticsBizFilter === 'All') {
            const uniqueBatches = new Set();
            students.forEach(s => {
                (s.enrolledBatches || []).forEach(b => uniqueBatches.add(b));
            });
            setAnalyticsAvailableBatches([...uniqueBatches]);
        } else {
            axios.get(`/admin/batches/${analyticsBizFilter}`)
                .then(res => {
                    const bData = res.data.batches || res.data || [];
                    setAnalyticsAvailableBatches(bData.map(b => b.name));
                }).catch(err => console.error(err));
        }
    }, [analyticsBizFilter, students]);

    // 🔥 SRI LANKAN NIC BIRTH-YEAR PARSER 🔥
    const getBirthYearFromNIC = (nic) => {
        if (!nic) return null;
        const cleanNic = nic.replace(/[^0-9vxVX]/g, '').trim();
        if (cleanNic.length === 10 && (cleanNic.endsWith('v') || cleanNic.endsWith('V') || cleanNic.endsWith('x') || cleanNic.endsWith('X'))) {
            const yearPart = cleanNic.substring(0, 2);
            return 1900 + parseInt(yearPart);
        } else if (cleanNic.length === 12 && /^\d+$/.test(cleanNic)) {
            const yearPart = cleanNic.substring(0, 4);
            return parseInt(yearPart);
        }
        if (/^\d{9}$/.test(cleanNic)) {
            const yearPart = cleanNic.substring(0, 2);
            return 1900 + parseInt(yearPart);
        }
        return null;
    };

    const getAge = (nic) => {
        const birthYear = getBirthYearFromNIC(nic);
        if (!birthYear) return null;
        return 2026 - birthYear;
    };

    // Filter students for the report
    const reportStudents = useMemo(() => {
        return students.filter(student => {
            let matchesBiz = true;
            if (analyticsBizFilter !== 'All') {
                const selectedBiz = businesses.find(b => b.id.toString() === analyticsBizFilter);
                if (selectedBiz) matchesBiz = (student.enrolledBusinesses || []).includes(selectedBiz.name);
            }

            let matchesBatch = true;
            if (analyticsBatchFilter !== 'All') {
                matchesBatch = (student.enrolledBatches || []).includes(analyticsBatchFilter);
            }

            let matchesSearch = true;
            if (analyticsSearchQuery) {
                const searchLower = analyticsSearchQuery.toLowerCase();
                matchesSearch = 
                    (student.firstName + ' ' + student.lastName).toLowerCase().includes(searchLower) || 
                    (student.phone && student.phone.includes(analyticsSearchQuery)) ||
                    (student.nic && student.nic.toLowerCase().includes(searchLower)) ||
                    (student.id && `STU-${student.id}`.includes(analyticsSearchQuery.toUpperCase()));
            }

            return matchesBiz && matchesBatch && matchesSearch;
        });
    }, [students, analyticsBizFilter, analyticsBatchFilter, analyticsSearchQuery, businesses]);

    // Compute dynamic Age breakdown on report students
    const ageBreakdown = useMemo(() => {
        const counts = {};
        let parsedCount = 0;

        reportStudents.forEach(s => {
            const age = getAge(s.nic);
            if (age === null || isNaN(age)) {
                counts['Unknown'] = (counts['Unknown'] || 0) + 1;
            } else {
                parsedCount++;
                const ageKey = age.toString();
                counts[ageKey] = (counts[ageKey] || 0) + 1;
            }
        });

        const sortedEntries = Object.entries(counts).sort((a, b) => {
            if (a[0] === 'Unknown') return 1;
            if (b[0] === 'Unknown') return -1;
            return parseInt(a[0]) - parseInt(b[0]);
        });

        return {
            entries: sortedEntries,
            total: reportStudents.length,
            parsedCount
        };
    }, [reportStudents]);

    const displayedReportStudents = useMemo(() => {
        if (!analyticsActiveAgeFilter) return reportStudents;
        return reportStudents.filter(s => {
            const age = getAge(s.nic);
            if (analyticsActiveAgeFilter === 'Unknown') return age === null || isNaN(age);
            return age?.toString() === analyticsActiveAgeFilter;
        });
    }, [reportStudents, analyticsActiveAgeFilter]);

    // Export report data to CSV
    const exportCSV = () => {
        if (displayedReportStudents.length === 0) {
            toast.error("No data to export");
            return;
        }

        const headers = ["Student ID", "Full Name", "Phone", "NIC", "Age", "Enrolled Businesses", "Enrolled Batches", "Enrolled Subjects"];
        
        const rows = displayedReportStudents.map(s => {
            const age = getAge(s.nic);
            return [
                `STU-${s.id}`,
                `${s.firstName} ${s.lastName}`,
                s.phone || 'N/A',
                s.nic || 'N/A',
                age !== null && !isNaN(age) ? age : 'N/A',
                (s.enrolledBusinesses || []).join(', '),
                (s.enrolledBatches || []).join(', '),
                (s.enrolledSubjects || []).join(', ')
            ];
        });

        const csvRows = [headers.join(',')];
        rows.forEach(r => {
            csvRows.push(r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        
        const filename = `Student_Analytics_Report_${analyticsBizFilter !== 'All' ? 'Biz_' + analyticsBizFilter : 'All_Biz'}.csv`;
        link.setAttribute("download", filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV Report downloaded successfully!");
    };

    useEffect(() => { setCurrentPage(1); }, [searchQuery, filterBusinessId, filterBatch]);

    const filteredStudents = students.filter(student => {
        const matchesSearch = 
            (student.firstName + ' ' + student.lastName).toLowerCase().includes(searchQuery.toLowerCase()) || 
            (student.phone && student.phone.includes(searchQuery)) ||
            (student.nic && student.nic.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (student.id && `STU-${student.id}`.includes(searchQuery.toUpperCase()));

        let matchesBiz = true;
        if (canManageStudents && filterBusinessId !== 'All') {
            const selectedBiz = businesses.find(b => b.id.toString() === filterBusinessId);
            if (selectedBiz) matchesBiz = (student.enrolledBusinesses || []).includes(selectedBiz.name);
        }

        let matchesBatch = true;
        if (canManageStudents && filterBatch !== 'All') matchesBatch = (student.enrolledBatches || []).includes(filterBatch);

        let matchesGroup = true;
        if (filterPaymentGroups.length > 0) {
            matchesGroup = filterPaymentGroups.some(groupId => 
                (student.enrolledGroups || []).some(g => g.id === groupId)
            );
        }

        let matchesSubjects = true;
        if (filterSubjects.length > 0) {
            matchesSubjects = filterSubjects.some(sub => (student.enrolledSubjects || []).includes(sub));
        }

        return matchesSearch && matchesBiz && matchesBatch && matchesGroup && matchesSubjects;
    });

    const totalPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1;
    const paginatedStudents = filteredStudents.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // 🔥 Edit Details & Phone Numbers 🔥
    const handleEditSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await axios.put('/admin/students/update', editModal);
            toast.success("Student details updated successfully");
            setEditModal(null);
            fetchData();
        } catch (error) { toast.error("Failed to update student"); } finally { setIsSubmitting(false); }
    };

    // 🔥 Reset Password 🔥
    const handlePasswordReset = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await axios.post('/admin/students/reset-password', {
                studentId: passwordModal.id,
                newPassword: passwordModal.newPassword
            });
            toast.success("Password reset successfully");
            setLastResetPassword(passwordModal.newPassword);
        } catch (error) { toast.error("Failed to reset password"); } finally { setIsSubmitting(false); }
    };

    // 🔥 Copy to Clipboard 🔥
    const copyToClipboard = () => {
        navigator.clipboard.writeText(lastResetPassword);
        toast.success("Password Copied!");
        setTimeout(() => { setPasswordModal(null); setLastResetPassword(null); }, 1000); 
    };

    // 🔥 Edit Details & Phone Numbers 🔥 (මේක උඩින් තියෙනවා)

// 🔥 Delete Student Account (With Debug) 🔥
const handleDeleteStudent = async (studentId, studentName) => {
    if (!window.confirm(`Are you sure you want to permanently DELETE the account of ${studentName}? This action cannot be undone and will remove all their access.`)) return;
    
    const loadToast = toast.loading("Deleting student account...");
    console.log("🚀 [FRONTEND] Sending Delete Request for Student ID:", studentId);
    
    try {
        // අනිවාර්යයෙන්ම URL එක '/admin/admin-delete' විය යුතුයි
        const res = await axios.post('/admin/admin-delete', { studentId }); 
        
        console.log("✅ [FRONTEND] Delete Response Success:", res.data);
        toast.success("Student deleted successfully", { id: loadToast });
        fetchData(); 
    } catch (error) {
        console.error("❌ [FRONTEND] Delete failed Details:", error.response || error);
        toast.error(error.response?.data?.error || "Failed to delete student.", { id: loadToast });
    }
};
    const handleGhostLogin = async (student) => {
        if(!window.confirm(`Ghost Login as ${student.firstName}?`)) return;
        try {
            toast.loading("Initiating Ghost Login...", { id: "ghost" });
            const res = await axios.post('/admin/ghost-login', { studentId: student.id });
            const currentToken = localStorage.getItem('token');
            const currentUser = localStorage.getItem('user');
            setOriginalAdminSession({ token: currentToken, user: currentUser });
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('user', JSON.stringify(res.data.user));
            setGhostIframe('/student/dashboard');
            toast.success("Ghost Login Active!", { id: "ghost" });
        } catch (error) { toast.error("Ghost login failed.", { id: "ghost" }); }
    };

    const closeGhostLogin = () => {
        if (originalAdminSession) {
            localStorage.setItem('token', originalAdminSession.token);
            localStorage.setItem('user', originalAdminSession.user);
        }
        setGhostIframe(null);
        toast.success("Restored Admin Session.");
    };

    return (
        <div className="w-full text-gray-100 animate-in fade-in duration-300 font-sans pb-10">
            
            {/* Header Section */}
            <div className="mb-6 bg-black/20 backdrop-blur-xl border border-white/10 p-6 rounded-2xl shadow-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/10 rounded-xl text-white border border-white/10 shrink-0 shadow-inner">
                        <Database size={24}/>
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Student Data Center</h2>
                        <p className="text-gray-300 font-medium text-sm mt-0.5">Manage and overview all student records</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button 
                        onClick={() => { setShowAnalyticsModal(true); setAnalyticsBizFilter('All'); setAnalyticsBatchFilter('All'); }} 
                        className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl flex items-center gap-2 border border-violet-500/30 transition-all hover:scale-[1.02] shadow-lg outline-none cursor-pointer text-xs uppercase tracking-wider"
                    >
                        <BarChart3 size={15}/> Age & Analytics Report
                    </button>
                    <div className="bg-white/5 border border-white/10 px-5 py-2.5 rounded-xl flex items-center gap-4 shadow-inner">
                        <span className="text-sm font-semibold text-gray-400">Total Students</span>
                        <span className="text-xl font-bold text-white">{filteredStudents.length}</span>
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="mb-6 bg-black/20 backdrop-blur-xl p-5 rounded-2xl border border-white/10 shadow-lg flex flex-col gap-4 relative z-50">
                {/* Top Row: Search and Dropdowns */}
                <div className="flex flex-col md:flex-row gap-4 w-full">
                    {/* Search */}
                    <div className="flex-1 w-full relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                        <input 
                            type="text" 
                            placeholder="Search Name, Phone, NIC or STU-ID..." 
                            value={searchQuery} 
                            onChange={e => setSearchQuery(e.target.value)} 
                            className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-white/30 transition-all text-sm placeholder-gray-500 shadow-inner" 
                        />
                    </div>
                    
                    {/* Dropdowns */}
                    {canManageStudents && (
                        <div className="flex flex-wrap gap-3">
                            <select 
                                value={filterBusinessId} 
                                onChange={e => {setFilterBusinessId(e.target.value); setFilterBatch('All');}} 
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-white/30 cursor-pointer min-w-[180px] transition-all shadow-md appearance-none"
                            >
                                <option value="All" className="bg-[#1e1e1e]">All Businesses</option>
                                {businesses.map(biz => <option key={biz.id} value={biz.id} className="bg-[#1e1e1e]">{biz.name}</option>)}
                            </select>
                            <select 
                                value={filterBatch} 
                                onChange={e => setFilterBatch(e.target.value)} 
                                className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm font-medium text-white outline-none focus:border-white/30 cursor-pointer min-w-[180px] transition-all shadow-md appearance-none"
                            >
                                <option value="All" className="bg-[#1e1e1e]">All Batches</option>
                                {availableBatches.map(batchName => <option key={batchName} value={batchName} className="bg-[#1e1e1e]">{batchName}</option>)}
                            </select>
                        </div>
                    )}
                </div>

                {/* Bottom Row: Payment Groups & Subjects */}
                {canManageStudents && filterBatch !== 'All' && (
                    <div className="flex flex-col gap-4 pt-2 border-t border-white/5">
                        {availablePaymentGroups.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <span className="text-sm font-semibold text-gray-400 mr-2">Payment Groups:</span>
                                {availablePaymentGroups.map(group => {
                                    const isSelected = filterPaymentGroups.includes(group.id);
                                    return (
                                        <button
                                            key={group.id}
                                            onClick={() => {
                                                if (isSelected) setFilterPaymentGroups(prev => prev.filter(id => id !== group.id));
                                                else setFilterPaymentGroups(prev => [...prev, group.id]);
                                            }}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                                                isSelected 
                                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30' 
                                                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white'
                                            }`}
                                        >
                                            {group.name}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                        
                        {availableSubjects.length > 0 && (
                            <div className="flex items-center gap-2 relative mt-2">
                                <span className="text-sm font-semibold text-gray-400 mr-2">Subjects:</span>
                                
                                <div className="relative">
                                    <button 
                                        onClick={() => setIsSubjectsDropdownOpen(!isSubjectsDropdownOpen)}
                                        className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm font-medium text-white flex items-center justify-between min-w-[200px] hover:bg-white/5 transition-all outline-none"
                                    >
                                        <span>{filterSubjects.length > 0 ? `${filterSubjects.length} Selected` : 'Select Subjects'}</span>
                                        <ChevronDown size={16} className={`transition-transform text-gray-400 ml-3 ${isSubjectsDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isSubjectsDropdownOpen && (
                                        <div className="absolute top-full left-0 mt-2 w-72 bg-[#1a1a1a] border border-white/10 rounded-xl p-2 shadow-2xl z-50 max-h-64 overflow-y-auto custom-scrollbar flex flex-col gap-1">
                                            {availableSubjects.map(sub => {
                                                const isSelected = filterSubjects.includes(sub);
                                                return (
                                                    <label key={sub} className="flex items-center gap-3 p-2.5 hover:bg-white/5 rounded-lg cursor-pointer transition-colors w-full group">
                                                        <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors border shrink-0 ${isSelected ? 'bg-indigo-500 border-indigo-500' : 'border-white/20 group-hover:border-white/40'}`}>
                                                            {isSelected && <CheckCircle size={12} className="text-white" />}
                                                        </div>
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden" 
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                if (isSelected) setFilterSubjects(prev => prev.filter(s => s !== sub));
                                                                else setFilterSubjects(prev => [...prev, sub]);
                                                            }}
                                                        />
                                                        <span className={`text-sm select-none ${isSelected ? 'text-white font-medium' : 'text-gray-400 group-hover:text-gray-300'}`}>{sub}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Student List */}
            <div className="space-y-4">
                {loading ? (
                    <div className="text-center py-20"><Loader2 className="animate-spin text-white mx-auto" size={32}/></div>
                ) : paginatedStudents.length === 0 ? (
                    <div className="text-center py-20 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/10 shadow-lg">
                        <p className="text-gray-400 font-medium text-lg transition-colors">No students found.</p>
                    </div>
                ) : (
                    paginatedStudents.map(student => (
                        <div key={student.id} className="bg-black/20 backdrop-blur-xl border border-white/10 hover:border-white/30 p-5 rounded-2xl flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6 transition-all shadow-md hover:shadow-xl hover:bg-black/30 group">
                            
                            <div className="flex items-start gap-5 flex-1 min-w-0 w-full">
                                <img 
                                    src={resolveAvatarUrl(student.image, student.phone || student.whatsapp || student.optionalPhone, axios.defaults.baseURL)} 
                                    alt="Profile" 
                                    className="w-14 h-14 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0 mt-1 transition-all group-hover:scale-105"
                                    onError={(e) => {
                                        e.target.onerror = (err) => { err.target.onerror = null; err.target.src = '/logo.png'; };
                                        e.target.src = resolveAvatarUrl(null, student.phone || student.whatsapp || student.optionalPhone, axios.defaults.baseURL);
                                    }}
                                />
                                <div className="min-w-0 flex-1">
                                    <h4 className="font-bold text-lg text-white flex items-center gap-3 truncate">
                                        {student.firstName} {student.lastName}
                                        <span className="text-[10px] font-black bg-white/10 text-white px-2 py-0.5 rounded border border-white/20 uppercase tracking-tighter">STU-{student.id}</span>
                                    </h4>
                                    <div className="flex flex-wrap gap-x-5 gap-y-1 mt-1 text-sm text-gray-300">
                                        <span className="flex items-center gap-1.5"><span className="text-gray-500 font-bold uppercase text-[10px]">Phone:</span> {student.phone || 'N/A'}</span>
                                        <span className="flex items-center gap-1.5"><span className="text-gray-500 font-bold uppercase text-[10px]">NIC:</span> {student.nic || 'N/A'}</span>
                                        <span className="flex items-center gap-1.5 truncate"><span className="text-gray-500 font-bold uppercase text-[10px]">City:</span> {student.city || 'N/A'}</span>
                                    </div>
                                    
                                    <div className="mt-4 flex flex-col sm:flex-row gap-4 w-full">
                                        {(student.enrolledBusinesses || []).length > 0 && (
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-1">Businesses:</span>
                                                {(student.enrolledBusinesses || []).map((biz, i) => (
                                                    <span key={i} className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded border border-blue-500/30">{biz}</span>
                                                ))}
                                            </div>
                                        )}
                                        {(student.enrolledBatches || []).length > 0 && (
                                            <div className="flex flex-wrap gap-2 items-center">
                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-1">Batches:</span>
                                                {(student.enrolledBatches || []).map((batch, i) => (
                                                    <span key={i} className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/30">{batch}</span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex flex-wrap items-center justify-end gap-2 w-full xl:w-auto pt-4 xl:pt-0 border-t border-white/5 xl:border-t-0 shrink-0">
                                <button onClick={() => navigate(`/workspace/after-seminar-crm?searchQuery=${student.phone}`)} className="p-2.5 rounded-xl bg-white/5 text-white hover:bg-white/20 border border-white/10 transition-all shadow-sm outline-none" title="CRM Chat">
                                    <MessageSquare size={18} />
                                </button>
                                
                                <button onClick={() => setEditModal(student)} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-xs border border-white/10 shadow-sm outline-none">
                                    <Edit3 size={16}/> EDIT
                                </button>

                                <button onClick={() => setPasswordModal({ id: student.id, newPassword: '' })} className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white font-bold py-2.5 px-4 rounded-xl transition-all text-xs border border-orange-500/20 shadow-sm outline-none">
                                    <KeyRound size={16}/> RESET PASS
                                </button>

                                <button onClick={() => handleGhostLogin(student)} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl transition-all text-xs shadow-lg outline-none border border-emerald-400/50">
                                    <LogIn size={16}/> GHOST
                                </button>

                                {/* 🔥 DELETE BUTTON ADDED HERE 🔥 */}
                                {canDeleteStudents && (
                                    <button onClick={() => handleDeleteStudent(student.id, student.firstName)} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white font-bold py-2.5 px-4 rounded-xl transition-all text-xs border border-red-500/20 shadow-sm outline-none">
                                        <Trash2 size={16}/> DELETE
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-between items-center mt-6 bg-black/20 backdrop-blur-xl p-3.5 rounded-xl border border-white/10 shadow-lg">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white disabled:opacity-20 transition-all px-3 py-1"><ChevronLeft size={16}/> PREV</button>
                    <span className="text-sm font-medium text-gray-300">Page <span className="text-white font-black">{currentPage}</span> of {totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-white disabled:opacity-20 transition-all px-3 py-1">NEXT <ChevronRight size={16}/></button>
                </div>
            )}

            {/* Edit Modal (Number Changing works here) */}
            {editModal && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1e1e1e]/90 border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl relative max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4 shrink-0">
                            <div className="flex items-center gap-3">
                                <img 
                                    src={resolveAvatarUrl(editModal.image, editModal.phone || editModal.whatsapp || editModal.optionalPhone, axios.defaults.baseURL)}
                                    alt="Profile" 
                                    className="w-11 h-11 rounded-xl object-cover bg-black/50 border border-white/10 shrink-0"
                                    onError={(e) => {
                                        e.target.onerror = (err) => { err.target.onerror = null; err.target.src = '/logo.png'; };
                                        e.target.src = resolveAvatarUrl(null, editModal.phone || editModal.whatsapp || editModal.optionalPhone, axios.defaults.baseURL);
                                    }}
                                />
                                <div>
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">Edit Student Details</h3>
                                    <p className="text-xs text-gray-400 font-medium">STU-{editModal.id} • {editModal.firstName} {editModal.lastName}</p>
                                </div>
                            </div>
                            <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl transition-all border border-white/10 outline-none"><X size={18} /></button>
                        </div>
                        <form onSubmit={handleEditSubmit} className="space-y-4 overflow-y-auto custom-scrollbar pr-2 flex-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">First Name</label>
                                    <input type="text" value={editModal.firstName || ''} onChange={e => setEditModal({...editModal, firstName: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" required />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Last Name</label>
                                    <input type="text" value={editModal.lastName || ''} onChange={e => setEditModal({...editModal, lastName: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Primary Phone</label>
                                    <input type="text" value={editModal.phone || ''} onChange={e => setEditModal({...editModal, phone: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" required />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">WhatsApp</label>
                                    <input type="text" value={editModal.whatsapp || ''} onChange={e => setEditModal({...editModal, whatsapp: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Optional Phone</label>
                                    <input type="text" value={editModal.optionalPhone || ''} onChange={e => setEditModal({...editModal, optionalPhone: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" />
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">NIC Number</label>
                                <input type="text" value={editModal.nic || ''} onChange={e => setEditModal({...editModal, nic: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">House No / Name</label>
                                    <input type="text" value={editModal.addressHouseNo || ''} onChange={e => setEditModal({...editModal, addressHouseNo: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">Street</label>
                                    <input type="text" value={editModal.addressStreet || ''} onChange={e => setEditModal({...editModal, addressStreet: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">City</label>
                                    <input type="text" value={editModal.city || ''} onChange={e => setEditModal({...editModal, city: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-1 block">District</label>
                                    <input type="text" value={editModal.district || ''} onChange={e => setEditModal({...editModal, district: e.target.value})} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-white/30 shadow-inner" />
                                </div>
                            </div>
                            <div className="pt-4 shrink-0 border-t border-white/10 mt-2">
                                <button type="submit" disabled={isSubmitting} className="w-full bg-white text-black font-black py-3 rounded-xl transition-all hover:scale-[1.01] flex justify-center items-center gap-2 shadow-xl uppercase text-xs outline-none">
                                    {isSubmitting ? <Loader2 size={16} className="animate-spin"/> : <CheckCircle size={16}/>} Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Password Modal */}
            {passwordModal && createPortal(
                <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-[#1e1e1e]/90 border border-white/10 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="text-lg font-black text-white uppercase tracking-tight">Reset Password</h3>
                            <button onClick={() => { setPasswordModal(null); setLastResetPassword(null); }} className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl transition-all border border-white/10 outline-none"><X size={18} /></button>
                        </div>
                        {lastResetPassword ? (
                            <div className="animate-in zoom-in duration-300">
                                <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl text-center mb-5 shadow-inner">
                                    <CheckCircle className="text-emerald-400 mx-auto mb-2" size={36} />
                                    <p className="text-emerald-400 font-black text-xs uppercase mb-1">Password Changed!</p>
                                    <p className="text-white text-xl font-mono tracking-widest bg-black/40 py-3 rounded-xl border border-white/5 mt-3 shadow-inner select-all">{lastResetPassword}</p>
                                </div>
                                <button onClick={copyToClipboard} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg uppercase text-xs outline-none">
                                    Copy Password & Close
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handlePasswordReset}>
                                <div className="mb-6">
                                    <label className="text-[10px] text-gray-500 font-black uppercase mb-2 block">New Password</label>
                                    <input 
                                        type="text" 
                                        placeholder="Enter new password..." 
                                        value={passwordModal.newPassword} 
                                        onChange={e => setPasswordModal({...passwordModal, newPassword: e.target.value})} 
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500 font-mono tracking-wide shadow-inner" 
                                        required 
                                        minLength="6" 
                                    />
                                    <p className="text-[10px] text-gray-500 mt-2 font-medium">Please copy password before closing.</p>
                                </div>
                                <button type="submit" disabled={isSubmitting} className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-lg uppercase text-xs outline-none">
                                    {isSubmitting ? <Loader2 size={18} className="animate-spin"/> : <KeyRound size={18}/>} Reset Password
                                </button>
                            </form>
                        )}
                    </div>
                </div>,
                document.body
            )}

            {/* Ghost Login Iframe */}
            {ghostIframe && createPortal(
                <div className="fixed inset-0 z-[99999] bg-[#0f172a] flex flex-col animate-in fade-in duration-300">
                    <div className="w-full bg-black/40 backdrop-blur-2xl border-b border-white/10 px-6 py-3 flex justify-between items-center shadow-lg shrink-0">
                        <div className="flex items-center gap-3">
                            <MonitorPlay className="text-emerald-500 animate-pulse" size={20} />
                            <div>
                                <h3 className="text-white font-black text-sm uppercase tracking-tight">Ghost Login Active</h3>
                                <p className="text-emerald-400 text-[10px] font-black uppercase">Viewing as Student</p>
                            </div>
                        </div>
                        <button onClick={closeGhostLogin} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white border border-red-400/50 px-4 py-2 rounded-xl font-black transition-all text-xs shadow-lg uppercase outline-none animate-bounce">
                            <X size={16} /> End Session
                        </button>
                    </div>
                    <div className="flex-1 w-full relative bg-black/50">
                        <iframe src={ghostIframe} className="w-full h-full border-none" title="Ghost Login Student View"></iframe>
                    </div>
                </div>,
                document.body
            )}

            {/* 🔥 NEW DETAILED ANALYTICS AND REPORTS MODAL 🔥 */}
            {showAnalyticsModal && createPortal(
                <div className="fixed inset-0 z-[100] bg-[#030712]/90 backdrop-blur-xl flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-300 text-slate-200 analytics-modal-container">
                    
                    {/* Google Font & Custom Scrollbar Injection */}
                    <style>{`
                        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
                        
                        .analytics-modal-container * {
                            font-family: 'Plus Jakarta Sans', 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif !important;
                        }

                        /* Elegant custom scrollbar */
                        .analytics-modal-container .custom-scrollbar::-webkit-scrollbar {
                            width: 6px;
                            height: 6px;
                        }
                        .analytics-modal-container .custom-scrollbar::-webkit-scrollbar-track {
                            background: rgba(255, 255, 255, 0.01);
                            border-radius: 10px;
                        }
                        .analytics-modal-container .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: rgba(255, 255, 255, 0.08);
                            border-radius: 10px;
                            border: 1px solid rgba(255, 255, 255, 0.05);
                        }
                        .analytics-modal-container .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: rgba(99, 102, 241, 0.3);
                            border-color: rgba(99, 102, 241, 0.2);
                        }
                    `}</style>

                    <div className="bg-[#0b0e1a]/95 border border-white/10 rounded-3xl w-full max-w-[96vw] xl:max-w-[93vw] h-[94vh] flex flex-col shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden relative animate-in zoom-in duration-300">
                        {/* Decorative Top Glow Bar */}
                        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-50"></div>
                        
                        {/* 1. Modal Header (Fixed) */}
                        <div className="p-5 border-b border-white/10 bg-[#101428]/90 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 rounded-2xl text-white shadow-[0_0_20px_rgba(99,102,241,0.3)] shrink-0">
                                    <BarChart3 size={24} className="animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
                                        Analytics & Student Report
                                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest animate-pulse">Live Sync</span>
                                    </h3>
                                    <p className="text-gray-400 font-medium text-xs mt-0.5">Generate custom student reports with dynamic age breakdowns</p>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3 self-end md:self-auto">
                                <button 
                                    onClick={exportCSV} 
                                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-extrabold py-2.5 px-5 rounded-xl flex items-center gap-2 hover:scale-[1.02] transition-all text-xs uppercase tracking-wider outline-none cursor-pointer shadow-[0_4px_15px_rgba(99,102,241,0.3)]"
                                    title="Export directory data to CSV"
                                >
                                    <Download size={14}/> Export CSV
                                </button>
                                <button 
                                    onClick={() => { setShowAnalyticsModal(false); setAnalyticsSearchQuery(''); }} 
                                    className="text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-xl transition-all border border-white/10 hover:border-white/20 outline-none cursor-pointer"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* 2. Fixed Filters & Quick Stats */}
                        <div className="p-4 bg-[#0d1020]/90 border-b border-white/5 flex flex-col xl:flex-row gap-4 items-center shrink-0 relative z-10">
                            <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto items-start sm:items-center">
                                <div className="text-xs font-black text-indigo-300 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
                                    <Sparkles size={14} className="text-indigo-400"/> Filter Dataset:
                                </div>
                                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                                    <div className="relative">
                                        <select 
                                            value={analyticsBizFilter} 
                                            onChange={e => { setAnalyticsBizFilter(e.target.value); setAnalyticsBatchFilter('All'); setAnalyticsActiveAgeFilter(null); }}
                                            className="bg-[#14182b] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-semibold text-white outline-none focus:border-indigo-500/80 cursor-pointer appearance-none pr-8 hover:bg-[#181d33] transition-all shadow-inner"
                                        >
                                            <option value="All" className="bg-[#0b0e1b]">All Businesses</option>
                                            {businesses.map(biz => <option key={biz.id} value={biz.id} className="bg-[#0b0e1b]">{biz.name}</option>)}
                                        </select>
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <span className="text-[9px]">▼</span>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <select 
                                            value={analyticsBatchFilter} 
                                            onChange={e => { setAnalyticsBatchFilter(e.target.value); setAnalyticsActiveAgeFilter(null); }}
                                            className="bg-[#14182b] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-semibold text-white outline-none focus:border-indigo-500/80 cursor-pointer appearance-none pr-8 hover:bg-[#181d33] transition-all shadow-inner"
                                        >
                                            <option value="All" className="bg-[#0b0e1b]">All Batches</option>
                                            {analyticsAvailableBatches.map(name => <option key={name} value={name} className="bg-[#0b0e1b]">{name}</option>)}
                                        </select>
                                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                                            <span className="text-[9px]">▼</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Integrated Search within Modal for premium control */}
                            <div className="flex-1 w-full relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15}/>
                                <input 
                                    type="text" 
                                    placeholder="Search student in report by Name, Phone, NIC or STU-ID..." 
                                    value={analyticsSearchQuery} 
                                    onChange={e => setAnalyticsSearchQuery(e.target.value)} 
                                    className="w-full bg-[#080b16]/60 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-indigo-500/50 hover:border-white/20 transition-all placeholder-gray-500 shadow-inner" 
                                />
                                {analyticsSearchQuery && (
                                    <button 
                                        onClick={() => setAnalyticsSearchQuery('')} 
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-xs font-bold"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            
                            <div className="bg-[#14192d] border border-white/10 px-4 py-2 rounded-xl text-xs font-bold text-slate-300 shadow-inner flex gap-4 shrink-0 w-full sm:w-auto justify-between sm:justify-start items-center">
                                <span>Filtered: <strong className="text-indigo-400 font-extrabold text-sm">{reportStudents.length}</strong></span>
                                <span className="w-[1px] h-3 bg-white/15"></span>
                                <span>Parsed NIC: <strong className="text-emerald-400 font-extrabold text-sm">{ageBreakdown.parsedCount}</strong></span>
                            </div>
                        </div>

                        <div className="p-5 bg-[#080a13]/85 border-b border-white/5 shrink-0">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 w-full">
                                {ageBreakdown.entries.map(([range, count], idx) => {
                                    const percentage = ageBreakdown.total > 0 
                                        ? ((count / ageBreakdown.total) * 100).toFixed(1)
                                        : '0.0';
                                    
                                    const colorPalettes = [
                                        { bg: "from-pink-500/12 to-rose-500/5 text-pink-400 border-pink-500/25 hover:border-pink-500/50", progress: "from-pink-500 to-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]", badge: "bg-pink-500/15 text-pink-300 border border-pink-500/20" },
                                        { bg: "from-orange-500/12 to-amber-500/5 text-orange-400 border-orange-500/25 hover:border-orange-500/50", progress: "from-orange-500 to-amber-500 shadow-[0_0_12px_rgba(249,115,22,0.4)]", badge: "bg-orange-500/15 text-orange-300 border border-orange-500/20" },
                                        { bg: "from-emerald-500/12 to-teal-500/5 text-emerald-400 border-emerald-500/25 hover:border-emerald-500/50", progress: "from-emerald-500 to-teal-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]", badge: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" },
                                        { bg: "from-cyan-500/12 to-blue-500/5 text-cyan-400 border-cyan-500/25 hover:border-cyan-500/50", progress: "from-cyan-500 to-blue-500 shadow-[0_0_12px_rgba(6,182,212,0.4)]", badge: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/20" },
                                        { bg: "from-indigo-500/12 to-purple-500/5 text-indigo-400 border-indigo-500/25 hover:border-indigo-500/50", progress: "from-indigo-500 to-purple-500 shadow-[0_0_12px_rgba(99,102,241,0.4)]", badge: "bg-indigo-500/15 text-indigo-300 border border-indigo-500/20" }
                                    ];

                                    let colorClasses = range === 'Unknown' ? {
                                        bg: "from-slate-700/10 to-slate-800/5 text-slate-300 border-slate-700/25 hover:border-slate-700/40",
                                        progress: "from-slate-600 to-slate-500 shadow-none",
                                        badge: "bg-slate-700/25 text-slate-300 border border-slate-700/30"
                                    } : colorPalettes[idx % colorPalettes.length];

                                    const isZero = count === 0;
                                    const isActive = analyticsActiveAgeFilter === range;

                                    return (
                                        <button 
                                            key={range} 
                                            onClick={() => setAnalyticsActiveAgeFilter(isActive ? null : range)}
                                            className={`rounded-2xl p-4 flex flex-col justify-between transition-all duration-300 min-h-[110px] text-left outline-none cursor-pointer ${
                                                isActive ? 'ring-2 ring-white/50 scale-[1.02] shadow-[0_0_30px_rgba(255,255,255,0.1)] ' : 'hover:scale-[1.03] '
                                            } ${
                                                isZero 
                                                    ? 'bg-[#0f1225]/40 border border-white/[0.04] text-slate-500' 
                                                    : 'bg-gradient-to-br ' + colorClasses.bg + ' border shadow-xl'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1.5 w-full">
                                                <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg ${
                                                    isZero ? 'bg-white/[0.03] border border-white/[0.05] text-slate-500' : colorClasses.badge
                                                }`}>
                                                    {range === 'Unknown' ? 'NO NIC' : `${range} YRS`}
                                                </span>
                                                <span className={`text-[10px] font-bold ${isZero ? 'text-slate-600' : 'text-slate-400'}`}>
                                                    Ratio: <strong className={`text-xs font-extrabold ${isZero ? 'text-slate-600' : 'text-white'}`}>{percentage}%</strong>
                                                </span>
                                            </div>
                                            
                                            <div className="my-2 flex items-baseline gap-1.5">
                                                <span className={`text-3xl font-black tracking-tight ${isZero ? 'text-slate-600' : 'text-white'}`}>
                                                    {count.toLocaleString()}
                                                </span>
                                                <span className={`text-xs font-semibold ${isZero ? 'text-slate-700' : 'text-slate-400'}`}>
                                                    students
                                                </span>
                                            </div>
                                            
                                            <div className="w-full mt-1.5">
                                                <div className="w-full bg-[#080a13] h-[7px] rounded-full overflow-hidden border border-white/5 shadow-inner">
                                                    <div 
                                                        className={`bg-gradient-to-r ${colorClasses.progress} h-full rounded-full transition-all duration-500`}
                                                        style={{ width: `${percentage}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 4. Independent Scrollable Table Section */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-[#070914] flex flex-col">
                            <div className="bg-[#0f1325]/90 border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                                <div className="p-4 border-b border-white/10 bg-[#12172f]/80 backdrop-blur-md flex justify-between items-center shrink-0">
                                    <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                                        <span className="w-2 h-4 bg-gradient-to-b from-indigo-500 to-purple-500 rounded"></span>
                                        Report Student Directory
                                    </h4>
                                    <span className="text-xs bg-white/5 text-gray-400 font-semibold px-3 py-1 rounded-lg border border-white/5">
                                        Showing <strong className="text-white font-bold">{displayedReportStudents.length}</strong> verified entries
                                    </span>
                                </div>
                                
                                <div className="overflow-x-auto custom-scrollbar">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-[#12172f]/90 text-[10px] font-extrabold uppercase tracking-widest text-indigo-300 border-b border-white/10 sticky top-0 z-10 backdrop-blur-md">
                                            <tr>
                                                <th className="py-4 px-5">ID</th>
                                                <th className="py-4 px-5">Student Name</th>
                                                <th className="py-4 px-5">NIC Number</th>
                                                <th className="py-4 px-5">Age</th>
                                                <th className="py-4 px-5">Contact Details</th>
                                                <th className="py-4 px-5">Active Batch</th>
                                                <th className="py-4 px-5">Enrolled Subjects</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/[0.04] bg-[#0c0f1e]/40 font-medium">
                                            {displayedReportStudents.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="text-center py-20 text-slate-500 font-bold text-sm bg-[#090c17]/30">
                                                        No students match the selected filters or search query.
                                                    </td>
                                                </tr>
                                            ) : (
                                                displayedReportStudents.map((s) => {
                                                    const age = getAge(s.nic);
                                                    
                                                    // Determine visual glowing border classes depending on age group
                                                    let ageBadgeClass = "bg-indigo-500/10 text-indigo-300 border border-indigo-500/25";
                                                    if (age !== null && !isNaN(age)) {
                                                        if (age >= 15 && age <= 19) ageBadgeClass = "bg-pink-500/10 text-pink-300 border border-pink-500/20";
                                                        else if (age >= 20 && age <= 24) ageBadgeClass = "bg-orange-500/10 text-orange-300 border border-orange-500/20";
                                                        else if (age >= 25 && age <= 29) ageBadgeClass = "bg-yellow-500/10 text-yellow-300 border border-yellow-500/20";
                                                        else if (age >= 30 && age <= 34) ageBadgeClass = "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20";
                                                        else if (age >= 35 && age <= 39) ageBadgeClass = "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20";
                                                        else if (age >= 40 && age <= 44) ageBadgeClass = "bg-blue-500/10 text-blue-300 border border-blue-500/20";
                                                        else if (age >= 45 && age <= 49) ageBadgeClass = "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20";
                                                        else if (age >= 50) ageBadgeClass = "bg-purple-500/10 text-purple-300 border border-purple-500/20";
                                                    }

                                                    return (
                                                        <tr key={s.id} className="hover:bg-[#151a37]/50 transition-colors duration-250 group">
                                                            <td className="py-4 px-5">
                                                                <span className="bg-indigo-500/10 text-indigo-400 font-bold font-mono tracking-wide px-2.5 py-1 rounded-lg border border-indigo-500/20 shadow-sm text-[10px] group-hover:border-indigo-500/50 transition-colors">
                                                                    STU-{s.id}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-5">
                                                                <span className="font-semibold text-white text-sm tracking-wide group-hover:text-indigo-300 transition-colors">
                                                                    {s.firstName} {s.lastName}
                                                                </span>
                                                            </td>
                                                            <td className="py-4 px-5 font-semibold text-slate-300 font-mono tracking-wider">
                                                                {s.nic ? (
                                                                    <span className="bg-white/[0.02] border border-white/5 rounded px-2 py-0.5">{s.nic}</span>
                                                                ) : (
                                                                    <span className="text-slate-600 font-normal italic">N/A</span>
                                                                )}
                                                            </td>
                                                            <td className="py-4 px-5">
                                                                {age !== null && !isNaN(age) ? (
                                                                    <span className={`px-2.5 py-1 rounded-lg font-black font-mono text-[10px] shadow-sm tracking-wide uppercase ${ageBadgeClass}`}>
                                                                        {age} Yrs
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-slate-600 italic font-medium">N/A</span>
                                                                )}
                                                            </td>
                                                            <td className="py-4 px-5">
                                                                <div className="flex flex-col text-slate-300 font-medium gap-0.5 font-mono">
                                                                    <span className="tracking-wide text-xs">{s.phone || 'N/A'}</span>
                                                                    {s.whatsapp && s.whatsapp !== s.phone && (
                                                                        <span className="text-[9px] text-gray-500 font-normal">WA: {s.whatsapp}</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-5">
                                                                <div className="flex flex-col gap-1 max-w-[200px]">
                                                                    {(s.enrolledBatches || []).map((batch, bi) => (
                                                                        <span key={bi} className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black border border-emerald-500/15 px-2.5 py-0.5 rounded-lg text-center truncate tracking-wide">
                                                                            {batch}
                                                                        </span>
                                                                    ))}
                                                                    {(s.enrolledBatches || []).length === 0 && (
                                                                        <span className="text-slate-600 font-medium italic text-[11px]">Unassigned</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-5">
                                                                <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                                                                    {(s.enrolledSubjects || []).map((sub, si) => (
                                                                        <span key={si} className="bg-[#191f3a]/80 text-slate-300 text-[9px] font-black border border-slate-700/60 px-2 py-0.5 rounded-md shadow-sm">
                                                                            {sub}
                                                                        </span>
                                                                    ))}
                                                                    {(s.enrolledSubjects || []).length === 0 && (
                                                                        <span className="text-slate-600 font-medium italic text-[11px]">None</span>
                                                                    )}
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
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
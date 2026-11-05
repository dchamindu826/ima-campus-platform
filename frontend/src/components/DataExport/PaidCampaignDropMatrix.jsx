import React, { useState, useEffect } from 'react';
import axios from '../../api/axios';
import { Search, Filter, Loader2, Building2, Layers, AlertCircle, ArrowDown, User, Users } from 'lucide-react';

export default function PaidCampaignDropMatrix({ loggedInUser }) {
    const [businesses, setBusinesses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [selectedBiz, setSelectedBiz] = useState('');
    const [selectedBatch, setSelectedBatch] = useState('');
    
    const [months, setMonths] = useState([]);
    const [studentsData, setStudentsData] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [enrollmentFilter, setEnrollmentFilter] = useState('ALL');
    const [selectedCoordinator, setSelectedCoordinator] = useState('ALL');
    const [visibleCount, setVisibleCount] = useState(50);
    const [showUnassignedModal, setShowUnassignedModal] = useState(false);

    useEffect(() => {
        fetchBusinesses();
    }, []);

    const fetchBusinesses = async () => {
        try {
            const res = await axios.get('/admin/businesses');
            const fetchedBiz = res.data?.businesses || res.data || [];
            setBusinesses(fetchedBiz);
            if (fetchedBiz && fetchedBiz.length > 0) {
                setSelectedBiz(fetchedBiz[0].id.toString());
                fetchBatches(fetchedBiz[0].id);
            }
        } catch (err) { console.error(err); }
    };

    const fetchBatches = async (bizId) => {
        try {
            const res = await axios.get(`/admin/batches/${bizId}`);
            const fetchedBatches = res.data?.batches || res.data || [];
            setBatches(fetchedBatches);
            if (fetchedBatches && fetchedBatches.length > 0) {
                setSelectedBatch(fetchedBatches[0].id.toString());
            } else {
                setSelectedBatch('');
            }
        } catch (err) { console.error(err); }
    };

    const handleBizChange = (e) => {
        const bId = e.target.value;
        setSelectedBiz(bId);
        fetchBatches(bId);
        setStudentsData([]);
        setMonths([]);
    };

    useEffect(() => {
        if (selectedBiz && selectedBatch && selectedBatch !== 'null') {
            fetchMatrixData();
        } else {
            setStudentsData([]);
            setMonths([]);
        }
    }, [selectedBiz, selectedBatch]);

    const fetchMatrixData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get('/admin/data-export/paid-campaign', {
                params: { businessId: selectedBiz, batchId: selectedBatch }
            });
            setMonths(res.data.months || []);
            setStudentsData(res.data.students || []);
        } catch (err) {
            setError("Failed to fetch matrix data.");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = () => {
        setVisibleCount(prev => prev + 50);
    };

    const filteredData = studentsData.filter(stu => {
        const term = searchTerm.toLowerCase();
        const matchesSearch = !term ||
            stu.studentName?.toLowerCase().includes(term) ||
            stu.studentNo?.toLowerCase().includes(term) ||
            stu.phone?.includes(term) ||
            stu.whatsapp?.includes(term);

        const matchesType = enrollmentFilter === 'ALL' ||
            (stu.type && stu.type.toUpperCase() === enrollmentFilter);

        const matchesCoordinator = selectedCoordinator === 'ALL' ||
            (stu.coordinator === selectedCoordinator);

        return matchesSearch && matchesType && matchesCoordinator;
    });

    // Unique Coordinators List for Dropdown
    const uniqueCoordinators = ['ALL', ...new Set(studentsData.map(s => s.coordinator || 'Unassigned'))].sort();

    // Summary Statistics Calculation
    const totalStudents = studentsData.length;
    const assignedStudents = studentsData.filter(s => s.coordinator && s.coordinator !== 'Unassigned').length;
    const unassignedStudentsList = studentsData.filter(s => !s.coordinator || s.coordinator === 'Unassigned');
    const unassignedStudents = unassignedStudentsList.length;

    const coordinatorBreakdown = {};
    studentsData.forEach(stu => {
        const coord = stu.coordinator || 'Unassigned';
        if (!coordinatorBreakdown[coord]) {
            coordinatorBreakdown[coord] = { total: 0, Full: 0, Monthly: 0, Installment: 0, Upgrade: 0, Hybrid: 0 };
        }
        coordinatorBreakdown[coord].total += 1;
        
        const t = stu.type ? stu.type : 'Unknown';
        if (coordinatorBreakdown[coord][t] !== undefined) {
            coordinatorBreakdown[coord][t] += 1;
        }
    });

    const processedData = filteredData.slice(0, visibleCount);

    const getRowColor = (type) => {
        switch(type) {
            case 'Full': return 'bg-emerald-500/5 hover:bg-emerald-500/10 border-emerald-500/10';
            case 'Monthly': return 'bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/10';
            case 'Installment': return 'bg-orange-500/5 hover:bg-orange-500/10 border-orange-500/10';
            case 'Upgrade': return 'bg-purple-500/5 hover:bg-purple-500/10 border-purple-500/10';
            case 'Hybrid': return 'bg-pink-500/5 hover:bg-pink-500/10 border-pink-500/10';
            default: return 'bg-white/5 hover:bg-white/10 border-white/5';
        }
    };

    const getBadgeColor = (type) => {
        switch(type) {
            case 'Full': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
            case 'Monthly': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            case 'Installment': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
            case 'Upgrade': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
            case 'Hybrid': return 'bg-pink-500/20 text-pink-300 border-pink-500/30';
            default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-black/20 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Layers className="text-pink-400" />
                        Paid Campaign Drop Matrix
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        Track month-over-month subject drops for retention.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="bg-black/20 p-4 rounded-xl border border-white/10">
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Building2 size={14} /> Business
                    </label>
                    <select
                        value={selectedBiz}
                        onChange={handleBizChange}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    >
                        {businesses.map(b => (
                            <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/10">
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Layers size={14} /> Batch
                    </label>
                    <select
                        value={selectedBatch}
                        onChange={(e) => setSelectedBatch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    >
                        {batches.map(b => (
                            <option key={b.id} value={b.id} className="bg-gray-900">{b.name}</option>
                        ))}
                    </select>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/10">
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Search size={14} /> Search Student
                    </label>
                    <input
                        type="text"
                        placeholder="Name, Phone, NIC..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    />
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/10">
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <Filter size={14} /> Plan Type
                    </label>
                    <select
                        value={enrollmentFilter}
                        onChange={(e) => setEnrollmentFilter(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    >
                        <option value="ALL" className="bg-gray-900">All Plans</option>
                        <option value="MONTHLY" className="bg-gray-900">Monthly</option>
                        <option value="FULL" className="bg-gray-900">Full Payment</option>
                        <option value="INSTALLMENT" className="bg-gray-900">Installment</option>
                        <option value="UPGRADE" className="bg-gray-900">Upgrade</option>
                        <option value="HYBRID" className="bg-gray-900">Hybrid</option>
                    </select>
                </div>

                <div className="bg-black/20 p-4 rounded-xl border border-white/10">
                    <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                        <User size={14} /> Coordinator
                    </label>
                    <select
                        value={selectedCoordinator}
                        onChange={(e) => setSelectedCoordinator(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pink-500/50"
                    >
                        {uniqueCoordinators.map(c => (
                            <option key={c} value={c} className="bg-gray-900">
                                {c === 'ALL' ? 'All Coordinators' : c}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Summary Dashboard */}
            {!loading && studentsData.length > 0 && (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gradient-to-br from-black/40 to-black/20 p-6 rounded-2xl border border-white/10 backdrop-blur-xl">
                            <h3 className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Total Students</h3>
                            <p className="text-3xl font-black text-white">{totalStudents}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500/20 to-black/20 p-6 rounded-2xl border border-emerald-500/20 backdrop-blur-xl">
                            <h3 className="text-emerald-400 text-sm font-medium uppercase tracking-wider mb-1">Assigned</h3>
                            <p className="text-3xl font-black text-white">{assignedStudents}</p>
                        </div>
                        <div 
                            onClick={() => unassignedStudents > 0 && setShowUnassignedModal(true)}
                            className={`bg-gradient-to-br from-red-500/20 to-black/20 p-6 rounded-2xl border border-red-500/20 backdrop-blur-xl transition-colors ${unassignedStudents > 0 ? 'cursor-pointer hover:bg-red-500/10' : ''}`}
                        >
                            <h3 className="text-red-400 text-sm font-medium uppercase tracking-wider mb-1">Unassigned</h3>
                            <p className="text-3xl font-black text-white">{unassignedStudents}</p>
                            <p className="text-[10px] text-gray-500 mt-2 leading-tight">Students may be unassigned if they registered via the web with a different number than the one they use for CRM messages. {unassignedStudents > 0 && 'Click to view list.'}</p>
                        </div>
                    </div>

                    <div className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl mt-8">
                        <div className="px-6 py-5 bg-gradient-to-r from-black/60 to-transparent border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-white font-bold tracking-wide flex items-center gap-3">
                                <Users size={20} className="text-pink-400" />
                                Coordinator Breakdown
                            </h2>
                        </div>
                        <div className="p-6 bg-black/10">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                {Object.entries(coordinatorBreakdown)
                                    .sort((a, b) => b[1].total - a[1].total)
                                    .map(([name, stats]) => (
                                    <div key={name} className="group relative bg-[#1c1f2e] border border-white/5 rounded-2xl p-5 hover:-translate-y-1 hover:shadow-2xl hover:shadow-pink-500/10 transition-all duration-300 overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                        
                                        <div className="relative z-10">
                                            <div className="flex justify-between items-start mb-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center shadow-inner">
                                                        <User size={20} className="text-gray-400 group-hover:text-pink-400 transition-colors" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-white font-bold text-sm leading-tight group-hover:text-pink-200 transition-colors">{name}</h3>
                                                        <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-widest font-bold">Assigned</p>
                                                    </div>
                                                </div>
                                                <div className="bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-pink-500/20 px-3.5 py-1.5 rounded-xl flex items-center justify-center shadow-lg">
                                                    <span className="text-white font-black text-lg">{stats.total}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                {stats.Full > 0 && (
                                                    <div className="flex justify-between items-center bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20">
                                                        <span className="text-[10px] text-emerald-400/80 font-black uppercase tracking-wider">Full</span>
                                                        <span className="text-sm text-emerald-300 font-black">{stats.Full}</span>
                                                    </div>
                                                )}
                                                {stats.Monthly > 0 && (
                                                    <div className="flex justify-between items-center bg-blue-500/10 px-3 py-2 rounded-xl border border-blue-500/20">
                                                        <span className="text-[10px] text-blue-400/80 font-black uppercase tracking-wider">Monthly</span>
                                                        <span className="text-sm text-blue-300 font-black">{stats.Monthly}</span>
                                                    </div>
                                                )}
                                                {stats.Installment > 0 && (
                                                    <div className="flex justify-between items-center bg-orange-500/10 px-3 py-2 rounded-xl border border-orange-500/20">
                                                        <span className="text-[10px] text-orange-400/80 font-black uppercase tracking-wider">Instal</span>
                                                        <span className="text-sm text-orange-300 font-black">{stats.Installment}</span>
                                                    </div>
                                                )}
                                                {stats.Upgrade > 0 && (
                                                    <div className="flex justify-between items-center bg-purple-500/10 px-3 py-2 rounded-xl border border-purple-500/20">
                                                        <span className="text-[10px] text-purple-400/80 font-black uppercase tracking-wider">Upgrade</span>
                                                        <span className="text-sm text-purple-300 font-black">{stats.Upgrade}</span>
                                                    </div>
                                                )}
                                                {stats.Hybrid > 0 && (
                                                    <div className="flex justify-between items-center bg-pink-500/10 px-3 py-2 rounded-xl border border-pink-500/20">
                                                        <span className="text-[10px] text-pink-400/80 font-black uppercase tracking-wider">Hybrid</span>
                                                        <span className="text-sm text-pink-300 font-black">{stats.Hybrid}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            {loading ? (
                <div className="flex flex-col justify-center items-center h-64 bg-black/20 rounded-2xl border border-white/10">
                    <Loader2 size={32} className="text-pink-500 animate-spin mb-4" />
                    <p className="text-gray-400 font-medium">Processing Data...</p>
                </div>
            ) : error ? (
                <div className="flex justify-center items-center h-64 bg-red-500/10 rounded-2xl border border-red-500/20 text-red-400">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={20} />
                        {error}
                    </div>
                </div>
            ) : processedData.length === 0 ? (
                <div className="flex justify-center items-center h-64 bg-black/20 rounded-2xl border border-white/10 text-gray-500">
                    No records found for selected batch and filters.
                </div>
            ) : (
                <div className="bg-black/20 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl">
                    <div className="overflow-x-auto max-h-[70vh]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-black/40 text-gray-400 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs border-b border-white/10">#</th>
                                    <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs border-b border-white/10">Student Name</th>
                                    <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs border-b border-white/10">Contact</th>
                                    <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs border-b border-white/10">Plan Type</th>
                                    <th className="px-4 py-4 font-semibold uppercase tracking-wider text-xs border-b border-white/10">Coordinator</th>
                                    {months.map(m => (
                                        <th key={m.id} className="px-4 py-4 font-semibold uppercase tracking-wider text-xs border-b border-white/10 text-center min-w-[150px]">
                                            {m.name}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {processedData.map((stu, index) => (
                                    <tr key={stu.id} className={`transition-colors border-l-2 ${getRowColor(stu.type)}`}>
                                        <td className="px-4 py-3 text-gray-500 font-medium">{index + 1}</td>
                                        <td className="px-4 py-3">
                                            <div className="text-white font-medium">{stu.studentName}</div>
                                            <div className="text-xs text-gray-500">{stu.studentNo}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-gray-300">{stu.phone || '-'}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${getBadgeColor(stu.type)}`}>
                                                {stu.type || 'Unknown'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="text-white font-medium">{stu.coordinator}</div>
                                            {stu.leadType && stu.leadType !== '-' && (
                                                <div className="text-[11px] text-gray-500 font-medium mt-0.5">{stu.leadType}</div>
                                            )}
                                        </td>
                                        
                                        {/* Dynamic Month Cells with Drop Logic */}
                                        {months.map((m, mIdx) => {
                                            const currentSubjects = stu.matrixValues[m.id]?.activeSubjects || [];
                                            const prevMonth = mIdx > 0 ? months[mIdx - 1] : null;
                                            const prevSubjects = prevMonth ? (stu.matrixValues[prevMonth.id]?.activeSubjects || []) : [];
                                            
                                            // Find dropped subjects
                                            const dropped = prevSubjects.filter(sub => !currentSubjects.includes(sub));
                                            const isDrop = dropped.length > 0;
                                            
                                            // Even if no drop, maybe it's just 0 subjects.
                                            const isEmpty = currentSubjects.length === 0;

                                            return (
                                                <td key={m.id} className="px-4 py-3 align-top border-l border-white/5">
                                                    <div className="flex flex-col gap-1 w-full max-w-[200px]">
                                                        {isDrop && (
                                                            <div className="bg-red-500/20 text-red-300 border border-red-500/30 rounded-md p-1.5 text-[10px] font-medium leading-tight whitespace-normal">
                                                                <div className="flex items-center gap-1 mb-0.5">
                                                                    <ArrowDown size={12} className="text-red-400" />
                                                                    <span className="font-bold">Dropped:</span>
                                                                </div>
                                                                {dropped.join(', ')}
                                                            </div>
                                                        )}
                                                        
                                                        {currentSubjects.length > 0 ? (
                                                            <div className="bg-white/5 rounded-md p-1.5 text-[10px] text-gray-400 whitespace-normal mt-1 border border-white/5">
                                                                <span className="text-gray-500 block mb-0.5">Active ({currentSubjects.length}):</span>
                                                                {currentSubjects.join(', ')}
                                                            </div>
                                                        ) : (
                                                            !isDrop && <div className="text-[10px] text-gray-600 text-center py-2">-</div>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredData.length > visibleCount && (
                        <div className="p-4 border-t border-white/10 flex justify-center bg-black/40">
                            <button 
                                onClick={handleLoadMore}
                                className="px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition-colors border border-white/10"
                            >
                                Load More ({filteredData.length - visibleCount} remaining)
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Unassigned Students Modal */}
            {showUnassignedModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#111827] rounded-3xl w-full max-w-3xl border border-white/10 shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-3xl">
                            <div>
                                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                    <AlertCircle className="text-red-400" size={24} />
                                    Unassigned Students List
                                </h2>
                                <p className="text-sm text-gray-400 mt-1">These students are not mapped to any coordinator in the AFTER_SEMINAR CRM campaign.</p>
                            </div>
                            <button onClick={() => setShowUnassignedModal(false)} className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-white/10 transition">
                                ✕
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                            {unassignedStudentsList.length === 0 ? (
                                <p className="text-center text-gray-400 py-10">No unassigned students.</p>
                            ) : (
                                <div className="space-y-3">
                                    {unassignedStudentsList.map(stu => (
                                        <div key={stu.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                            <div>
                                                <h4 className="font-bold text-white text-lg">{stu.studentName || 'Unknown Student'}</h4>
                                                <div className="flex gap-4 mt-2">
                                                    <span className="text-sm text-gray-400"><span className="text-gray-500">Phone:</span> {stu.phone || '-'}</span>
                                                    <span className="text-sm text-gray-400"><span className="text-gray-500">WhatsApp:</span> {stu.whatsapp || '-'}</span>
                                                    <span className="text-sm text-gray-400"><span className="text-gray-500">NIC/No:</span> {stu.studentNo || '-'}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-wide uppercase border ${getBadgeColor(stu.type)}`}>
                                                    {stu.type || 'Unknown'} Plan
                                                </span>
                                                {stu.leadType && stu.leadType !== '-' && (
                                                    <span className="text-xs font-bold text-indigo-400">{stu.leadType}</span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="p-6 border-t border-white/10 bg-black/20 rounded-b-3xl flex justify-end">
                            <button onClick={() => setShowUnassignedModal(false)} className="px-6 py-2.5 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-bold transition">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
